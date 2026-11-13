import {
  Array,
  Context,
  Effect,
  FileSystem,
  flow,
  Layer,
  Path,
  pipe,
  Predicate,
  Schema as S,
  Stream,
  String
} from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

import { check } from "../Check/Check.ts"
import { TraitOrigin } from "../Report/TraitOrigin.ts"
import { WorkspacePath } from "../util/util.ts"
import * as LocalDecisionCache from "./LocalDecisionCache.ts"
import * as LocalEnrichmentRegistry from "./LocalEnrichmentRegistry.ts"
import * as LocalSegmenterRegistry from "./LocalSegmenterRegistry.ts"
import * as TraitsConfig from "./TraitsConfig.ts"
import * as WorkspaceLayout from "./WorkspaceLayout.ts"
import * as WorkspaceModels from "./WorkspaceModels.ts"
import { WorkspaceRoot } from "./WorkspaceRoot.ts"
import * as WorkspaceTraits from "./WorkspaceTraits.ts"

/** Simultaneous file reads and `git show` subprocesses, so large path lists and trait sets stay within descriptor and process limits. */
const fileConcurrency = 16

/** Which workspace files to check, and which of the workspace's traits to check them against; every trait by default. */
export interface WorkspaceCheckRequest extends WorkspaceTraits.TraitSelection {
  /** Files to check, relative to the workspace root or absolute within it; every project file when omitted. */
  readonly paths?: ReadonlyArray<string> | undefined
}

/** Project files could not be listed, because `git ls-files` failed. */
export class ProjectFilesError extends S.TaggedError<ProjectFilesError>()("ProjectFilesError", {
  /** git ls-files' exit code. */
  exitCode: S.Int.annotateKey({ description: "git ls-files' exit code." })
}) {
  override get message(): string {
    return `Could not list project files (git ls-files exited with ${this.exitCode}). Checking every project file requires the workspace to be in a Git repository; otherwise pass the paths to check.`
  }
}

/** The workspace configuration extends trait collections, which checking does not support yet. */
export class ExtendsUnsupportedError extends S.TaggedError<ExtendsUnsupportedError>()("ExtendsUnsupportedError", {}) {
  override get message(): string {
    return "traits.json extends other trait collections, which checking does not support yet. Remove extends to check the workspace's own traits."
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

/** Checks workspace files against the selected traits with already loaded configuration, using the decision model and extension registries in context; comparing each file's working-tree text with its text at Git HEAD. */
export const run = Effect.fn("WorkspaceCheck.run")(function* (
  config: TraitsConfig.TraitsConfig,
  request: WorkspaceCheckRequest
) {
  if ((config.extends ?? []).length > 0) {
    return yield* ExtendsUnsupportedError.make({})
  }
  const names = yield* WorkspaceTraits.select(request)
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const { directory } = yield* WorkspaceRoot
  // Resolves relative to the workspace root even when it is a subdirectory of the repository.
  const committedText = Effect.fnUntraced(function* (file: WorkspacePath) {
    const handle = yield* spawner.spawn(
      ChildProcess.make("git", ["show", `HEAD:./${file}`], {
        cwd: directory,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "ignore"
      })
    )
    const { exitCode, text } = yield* Effect.all(
      { exitCode: handle.exitCode, text: handle.stdout.pipe(Stream.decodeText(), Stream.mkString) },
      { concurrency: "unbounded" }
    )
    // Untracked files, new files, and workspaces outside Git have no committed text.
    return exitCode === 0 ? text : undefined
  }, Effect.scoped)
  // Tracked and untracked files that Git does not ignore or the configuration excludes, relative to the workspace root; submodules and deleted files are dropped below.
  const projectFiles = Effect.gen(function* () {
    const excluded = Array.map(config.exclude ?? [], (pattern) => `:(exclude,glob)${pattern}`)
    const handle = yield* spawner.spawn(
      ChildProcess.make(
        "git",
        ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", ".", ...excluded],
        {
          cwd: directory,
          stdin: "ignore",
          stdout: "pipe",
          stderr: "ignore"
        }
      )
    )
    const { exitCode, listing } = yield* Effect.all(
      { exitCode: handle.exitCode, listing: handle.stdout.pipe(Stream.decodeText(), Stream.mkString) },
      { concurrency: "unbounded" }
    )
    if (exitCode !== 0) {
      return yield* ProjectFilesError.make({ exitCode })
    }
    const listed = pipe(listing, String.split("\0"), Array.filter(String.isNonEmpty), Array.dedupe)
    return yield* Effect.filter(
      listed,
      (file) =>
        fs.stat(path.join(directory, file)).pipe(
          Effect.map((info) => info.type === "File"),
          Effect.orElseSucceed(() => false)
        ),
      { concurrency: fileConcurrency }
    )
  }).pipe(Effect.scoped)
  // Symbolic links at HEAD, whose committed text is the path they point to rather than content of their own.
  const committedLinks = yield* Effect.gen(function* () {
    const handle = yield* spawner.spawn(
      ChildProcess.make("git", ["ls-tree", "-r", "-z", "HEAD", "--", "."], {
        cwd: directory,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "ignore"
      })
    )
    const tree = yield* handle.stdout.pipe(Stream.decodeText(), Stream.mkString)
    // Each entry is "<mode> <type> <object>\t<path>", with paths relative to the workspace root.
    return pipe(
      tree,
      String.split("\0"),
      Array.filter(String.startsWith("120000 ")),
      Array.map(flow(String.split("\t"), Array.drop(1), Array.join("\t"))),
      (paths) => new Set(paths)
    )
  }).pipe(
    Effect.scoped,
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
      if (listing && current !== undefined && String.includes("\u0000")(current)) {
        return undefined
      }
      const committed = committedLink
        ? undefined
        : yield* committedText(file).pipe(Effect.orElseSucceed(() => undefined))
      const before = committed === undefined ? undefined : { path: file, text: committed }
      if (current === undefined) {
        return before === undefined
          ? yield* WorkspaceFileError.make({
              path: file,
              problem: "it exists neither in the working tree nor at HEAD."
            })
          : { change: { before } }
      }
      return { change: { after: { path: file, text: current }, ...(before === undefined ? {} : { before }) } }
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
  return yield* check({ traits, changes })
})

/** Loads traits.json, builds its models, fresh extension registries, and the workspace's decision cache, and checks the requested files. */
const checkWorkspace = Effect.fn("WorkspaceCheck.check")(function* (request: WorkspaceCheckRequest) {
  const config = yield* TraitsConfig.load
  const registries = Layer.mergeAll(
    LocalSegmenterRegistry.layer,
    LocalEnrichmentRegistry.layer,
    // Unchanged traits and inputs reuse earlier decisions by the same decision model instead of asking it again.
    LocalDecisionCache.layer(JSON.stringify(config.models.decision))
  ).pipe(Layer.provideMerge(WorkspaceModels.layer(config)))
  return yield* run(config, request).pipe(Effect.provide(registries))
})

/** Checks workspace files against the workspace's traits and configured models; shared by the CLI and the MCP server. */
export class WorkspaceCheck extends Context.Service<WorkspaceCheck>()("traits/local/WorkspaceCheck", {
  make: Effect.gen(function* () {
    const services = yield* Effect.context<Effect.Services<ReturnType<typeof checkWorkspace>>>()
    return {
      /** Checks the requested files, reloading the workspace configuration and trait files on every call. */
      check: (request: WorkspaceCheckRequest) => checkWorkspace(request).pipe(Effect.provideContext(services))
    }
  })
}) {
  /** The checker; the program provides the platform (filesystem, paths, processes), HTTP, crypto, key-value storage, the time zone, and WorkspaceRoot. */
  static readonly layer = this.make.pipe(Layer.effect(this))
}
