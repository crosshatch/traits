import { Array, Context, Effect, FileSystem, flow, Layer, Path, pipe, Predicate, Schema as S, String } from "effect"

import { check } from "../Check/Check.ts"
import { TraitOrigin } from "../Report/TraitOrigin.ts"
import { CurrentSettings } from "../Settings.ts"
import { WorkspacePath } from "../util/WorkspacePath.ts"
import * as Git from "./Git.ts"
import * as LocalDecisionCache from "./LocalDecisionCache.ts"
import * as LocalEnrichmentRegistry from "./LocalEnrichmentRegistry.ts"
import * as LocalSegmenterRegistry from "./LocalSegmenterRegistry.ts"
import * as TraitsConfig from "./TraitsConfig.ts"
import * as WorkspaceLayout from "./WorkspaceLayout.ts"
import * as WorkspaceModels from "./WorkspaceModels.ts"
import { WorkspaceRoot } from "./WorkspaceRoot.ts"
import * as WorkspaceTraits from "./WorkspaceTraits.ts"

/** Which workspace files to check, and which of the workspace's traits to check them against; every trait by default. */
export interface WorkspaceCheckRequest extends WorkspaceTraits.TraitSelection {
  /** Files to check, relative to the workspace root or absolute within it; every project file when omitted. */
  readonly paths?: ReadonlyArray<string> | undefined
}

/** Project files could not be listed, because `git ls-files` failed. */
export class ProjectFilesError extends S.TaggedError<ProjectFilesError>()("ProjectFilesError", {
  /** git ls-files' exit code. */
  exitCode: S.Int.annotateKey({ description: "git ls-files' exit code." }),
  /** What git ls-files reported on stderr; empty when it reported nothing. */
  stderr: S.String.annotateKey({
    description: "What git ls-files reported on stderr; empty when it reported nothing."
  })
}) {
  override get message(): string {
    return `Could not list project files (git ls-files exited with ${this.exitCode}${this.stderr === "" ? "" : `: ${this.stderr}`}). Checking every project file requires the workspace to be in a Git repository; otherwise pass the paths to check.`
  }
}

/** A requested path is not a file within the workspace, in the working tree or at HEAD. */
export class WorkspaceFileError extends S.TaggedError<WorkspaceFileError>()("WorkspaceFileError", {
  /** The requested path. */
  path: S.String.annotateKey({ description: "The requested path." }),
  /** Why the path cannot be checked. */
  problem: S.String.annotateKey({ description: "Why the path cannot be checked." }),
  /** The underlying failure, when there is one. */
  cause: S.Defect().annotateKey({ description: "The underlying failure, when there is one." }).pipe(S.optionalKey)
}) {
  override get message(): string {
    return `Cannot check ${this.path}: ${this.problem}`
  }
}

/** Checks workspace files against the selected traits, comparing each file's working-tree text with its text at Git HEAD. The given configuration's settings govern the check, whatever settings are in context; the decision model and extension registries come from context, so build the model from the same configuration. */
export const run = Effect.fn("WorkspaceCheck.run")(function* (
  config: TraitsConfig.TraitsConfig,
  request: WorkspaceCheckRequest
) {
  const names = yield* WorkspaceTraits.select(request)
  // Bounds file reads and `git show` subprocesses, so large path lists and trait sets stay within descriptor and process limits.
  const { fileConcurrency } = config.check
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { directory } = yield* WorkspaceRoot
  // Tracked and untracked files that Git does not ignore or the configuration excludes, relative to the workspace root; submodules and deleted files are dropped below.
  const projectFiles = Effect.gen(function* () {
    const excluded = Array.map(config.exclude, (pattern) => `:(exclude,glob)${pattern}`)
    const { exitCode, stdout, stderr } = yield* Git.run(directory, [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ".",
      ...excluded
    ])
    if (exitCode !== 0) {
      return yield* ProjectFilesError.make({ exitCode, stderr: String.trim(stderr) })
    }
    const listed = pipe(stdout, String.split("\0"), Array.filter(String.isNonEmpty), Array.dedupe)
    return yield* Effect.filter(
      listed,
      (file) =>
        fs.stat(path.join(directory, file)).pipe(
          Effect.map((info) => info.type === "File"),
          Effect.orElseSucceed(() => false)
        ),
      { concurrency: fileConcurrency }
    )
  })
  // Symbolic links at HEAD, whose committed text is the path they point to rather than content of their own.
  const committedLinks = yield* Git.run(directory, ["ls-tree", "-r", "-z", "HEAD", "--", "."]).pipe(
    Effect.map((tree) =>
      // Each entry is "<mode> <type> <object>\t<path>", with paths relative to the workspace root.
      pipe(
        tree.stdout,
        String.split("\0"),
        Array.filter(String.startsWith("120000 ")),
        Array.map(flow(String.split("\t"), Array.drop(1), Array.join("\t"))),
        (paths) => new Set(paths)
      )
    ),
    // Workspaces outside Git, or without commits, have no committed links.
    Effect.orElseSucceed(() => new Set<string>())
  )
  const listing = request.paths === undefined
  const requestedPaths = listing ? yield* projectFiles : request.paths
  const workspacePaths = yield* Effect.forEach(
    requestedPaths,
    Effect.fnUntraced(function* (requested) {
      const absolute = path.resolve(directory, requested)
      // The workspace root is canonical, so canonicalize the parent too; it exists even for deleted files.
      const parent = yield* fs.realPath(path.dirname(absolute)).pipe(Effect.orElseSucceed(() => path.dirname(absolute)))
      return yield* pipe(
        path.relative(directory, path.join(parent, path.basename(absolute))),
        String.split(path.sep),
        Array.join("/"),
        S.decodeEffect(WorkspacePath),
        Effect.mapError(() => WorkspaceFileError.make({ path: requested, problem: "it is outside the workspace." }))
      )
    })
  )
  const changes = yield* Effect.forEach(
    Array.dedupe(workspacePaths),
    Effect.fnUntraced(function* (file) {
      const working = path.join(directory, file)
      // A symbolic link's text is the file it points to, which is checked under its own path, so links are skipped.
      const linked = yield* fs.lstat(working).pipe(
        Effect.map((info) => info.type === "SymbolicLink"),
        Effect.orElseSucceed(() => false)
      )
      const committedLink = committedLinks.has(file)
      if (linked || (committedLink && !(yield* fs.exists(working)))) {
        return undefined
      }
      const current = yield* fs.exists(working).pipe(
        Effect.flatMap((exists) => (exists ? fs.readFileString(working) : Effect.undefined)),
        Effect.mapError((cause) =>
          WorkspaceFileError.make({ path: file, problem: `it cannot be read: ${cause.message}`, cause })
        )
      )
      // Listed files include binaries such as images, which have no text to assess.
      if (listing && current !== undefined && pipe(current, String.includes("\u0000"))) {
        return undefined
      }
      const committed = committedLink
        ? undefined
        : // The path resolves relative to the workspace root even when that is a subdirectory of the repository.
          yield* Git.run(directory, ["show", `HEAD:./${file}`]).pipe(
            // Untracked files, new files, and workspaces outside Git have no committed text.
            Effect.map((shown) => (shown.exitCode === 0 ? shown.stdout : undefined)),
            Effect.orElseSucceed(() => undefined)
          )
      const before = committed === undefined ? undefined : { path: file, text: committed }
      if (current === undefined) {
        return before === undefined
          ? yield* WorkspaceFileError.make({
              path: file,
              problem: "it exists neither in the working tree nor at HEAD."
            })
          : { before }
      }
      return { after: { path: file, text: current }, ...(before === undefined ? {} : { before }) }
    }),
    { concurrency: fileConcurrency }
  ).pipe(Effect.map(Array.filter(Predicate.isNotUndefined)))
  const traits = yield* Effect.forEach(
    names,
    (name) =>
      Effect.map(WorkspaceTraits.load(name), (trait) => ({
        trait,
        origin: TraitOrigin.cases.File.make({ path: WorkspacePath.make(WorkspaceLayout.traitFile(name)) })
      })),
    { concurrency: fileConcurrency }
  )
  return yield* check({ traits, changes }).pipe(Effect.provideService(CurrentSettings, config))
})

/** Loads traits.json, builds its models, fresh extension registries, and the workspace's decision cache, and checks the requested files; returns the report with the verdict policy that configuration sets, if any. */
const checkWorkspace = Effect.fn("WorkspaceCheck.check")(function* (request: WorkspaceCheckRequest) {
  const config = yield* TraitsConfig.load
  const registries = Layer.mergeAll(
    LocalSegmenterRegistry.layer,
    LocalEnrichmentRegistry.layer,
    // Unchanged traits and inputs reuse earlier decisions by the same decision model instead of asking it again.
    LocalDecisionCache.layer(JSON.stringify(config.models.decision))
  ).pipe(Layer.provideMerge(WorkspaceModels.layer(config)))
  const report = yield* run(config, request).pipe(Effect.provide(registries))
  return { report, policy: config.check.policy }
})

/** Checks workspace files against the workspace's traits and configured models; shared by the CLI and the MCP server. */
export class WorkspaceCheck extends Context.Service<WorkspaceCheck>()("traits/local/WorkspaceCheck", {
  make: Effect.gen(function* () {
    const services = yield* Effect.context<Effect.Services<ReturnType<typeof checkWorkspace>>>()
    return {
      /** Checks the requested files, reloading the workspace configuration and trait files on every call; returns the report with the verdict policy check.policy in traits.json sets, if any. */
      check: (request: WorkspaceCheckRequest) => checkWorkspace(request).pipe(Effect.provideContext(services))
    }
  })
}) {
  /** The checker; the program provides the platform (filesystem, paths, processes), HTTP, crypto, key-value storage, the time zone, and WorkspaceRoot. */
  static readonly layer = this.make.pipe(Layer.effect(this))
}
