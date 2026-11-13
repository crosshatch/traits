import { Array, Effect, FileSystem, Order, Path, pipe, Schema as S, String } from "effect"

import { Trait } from "../Trait.ts"
import * as TraitFile from "../TraitFile.ts"
import { TraitName } from "../TraitName.ts"
import { TraitsEnvironment } from "../TraitsEnvironment/TraitsEnvironment.ts"
import * as ExtensionModule from "./ExtensionModule.ts"
import * as WorkspaceLayout from "./WorkspaceLayout.ts"
import { WorkspaceRoot } from "./WorkspaceRoot.ts"

/** A kebab-case environment name starting with a letter, matching .agents/traits/_environments/<name>.json. */
export type EnvironmentName = typeof EnvironmentName.Type
export const EnvironmentName = S.NonEmptyString.check(
  S.isPattern(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u),
  S.isMaxLength(200)
)
  .pipe(S.brand("traits/EnvironmentName"))
  .annotate({
    description:
      "A kebab-case environment name starting with a letter, matching .agents/traits/_environments/<name>.json."
  })

/** Which of the workspace's traits to check; all of them when neither is given. */
export interface TraitSelection {
  /** An environment in .agents/traits/_environments whose traits to check. */
  readonly environment?: EnvironmentName | undefined
  /** Trait names to check, within the environment when one is given. */
  readonly traits?: ReadonlyArray<TraitName> | undefined
}

/** The workspace's trait directory could not be listed. */
export class TraitsDirectoryError extends S.TaggedError<TraitsDirectoryError>()("TraitsDirectoryError", {
  /** The trait directory path. */
  path: S.String.annotateKey({ description: "The trait directory path." }),
  /** What is wrong with the directory or one of its files. */
  problem: S.String.annotateKey({ description: "What is wrong with the directory or one of its files." })
}) {
  override get message(): string {
    return `Cannot list traits in ${this.path}: ${this.problem}`
  }
}

/** A trait file could not be read. */
export class TraitFileReadError extends S.TaggedError<TraitFileReadError>()("TraitFileReadError", {
  /** The trait file path. */
  path: S.String.annotateKey({ description: "The trait file path." }),
  /** The underlying filesystem failure. */
  cause: S.Defect().annotateKey({ description: "The underlying filesystem failure." })
}) {
  override get message(): string {
    return `Could not read trait file ${this.path}. Every checked trait needs a .agents/traits/<name>.md file.`
  }
}

/** An environment file is missing, unreadable, or invalid. */
export class EnvironmentError extends S.TaggedError<EnvironmentError>()("EnvironmentError", {
  /** The environment name. */
  environment: S.String.annotateKey({ description: "The environment name." }),
  /** What is wrong with the environment. */
  problem: S.String.annotateKey({ description: "What is wrong with the environment." })
}) {
  override get message(): string {
    return `Cannot use environment "${this.environment}": ${this.problem}`
  }
}

/** Requested trait names have no trait file, or fall outside the selected environment. */
export class UnknownTraitsError extends S.TaggedError<UnknownTraitsError>()("UnknownTraitsError", {
  /** The unknown trait names. */
  names: S.Array(S.String).annotateKey({ description: "The unknown trait names." }),
  /** Where the names were requested and what they are missing from. */
  problem: S.String.annotateKey({ description: "Where the names were requested and what they are missing from." })
}) {
  override get message(): string {
    return `Unknown traits ${pipe(this.names, Array.join(", "))}: ${this.problem}`
  }
}

/** Every trait the workspace defines: the names of its .agents/traits/<name>.md files, sorted. */
export const all = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { directory } = yield* WorkspaceRoot
  const traitsDirectory = path.join(directory, WorkspaceLayout.directory)
  const entries = yield* fs
    .readDirectory(traitsDirectory)
    .pipe(Effect.mapError((cause) => TraitsDirectoryError.make({ path: traitsDirectory, problem: cause.message })))
  const files = Array.filter(entries, String.endsWith(".md"))
  const names = yield* Effect.forEach(files, (file) =>
    pipe(
      String.slice(0, -".md".length)(file),
      S.decodeEffect(TraitName),
      Effect.mapError(() =>
        TraitsDirectoryError.make({
          path: traitsDirectory,
          problem: `${file} is not named for a trait. Trait file names are kebab-case trait names starting with a letter, such as small-functions.md.`
        })
      )
    )
  )
  return Array.sort(names, Order.String)
}).pipe(Effect.withSpan("WorkspaceTraits.all"))

/** Loads .agents/traits/_environments/<name>.json; extending trait collections is not supported yet. */
export const environment = Effect.fn("WorkspaceTraits.environment")(function* (name: EnvironmentName) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { directory } = yield* WorkspaceRoot
  const file = WorkspaceLayout.environmentFile(name)
  const text = yield* fs.readFileString(path.join(directory, file)).pipe(
    Effect.catchReason("PlatformError", "NotFound", () =>
      Effect.gen(function* () {
        const available = yield* fs.readDirectory(path.join(directory, WorkspaceLayout.environments)).pipe(
          Effect.map(
            Array.flatMap((entry) => (String.endsWith(".json")(entry) ? [String.slice(0, -".json".length)(entry)] : []))
          ),
          Effect.orElseSucceed((): ReadonlyArray<string> => [])
        )
        return yield* EnvironmentError.make({
          environment: name,
          problem: `${file} does not exist. ${available.length === 0 ? "No environments are defined" : `Available environments: ${pipe(Array.sort(available, Order.String), Array.join(", "))}`}; omit the environment to check every trait.`
        })
      })
    ),
    Effect.catchTags({
      PlatformError: (cause) =>
        EnvironmentError.make({ environment: name, problem: `${file} cannot be read: ${cause.message}` })
    })
  )
  const loaded = yield* pipe(
    text,
    S.decodeEffect(S.fromJsonString(TraitsEnvironment), { onExcessProperty: "error" }),
    Effect.mapError((cause) =>
      EnvironmentError.make({
        environment: name,
        problem: `${file} must be JSON like { "traits": ["trait-name"] } listing distinct trait names: ${cause.message}`
      })
    )
  )
  if ((loaded.extends ?? []).length > 0) {
    return yield* EnvironmentError.make({
      environment: name,
      problem: `${file} extends other trait collections, which checking does not support yet.`
    })
  }
  return loaded
})

/** Resolves the trait names to check: every trait, narrowed by the environment and then by the requested names. */
export const select = Effect.fn("WorkspaceTraits.select")(function* (selection: TraitSelection) {
  const defined = yield* all
  const missing = (names: ReadonlyArray<TraitName>, among: ReadonlyArray<TraitName>) =>
    Array.filter(names, (name) => !Array.contains(among, name))
  let selected: ReadonlyArray<TraitName> = defined
  if (selection.environment !== undefined) {
    const { traits } = yield* environment(selection.environment)
    const undefinedTraits = missing(traits, defined)
    if (undefinedTraits.length > 0) {
      return yield* UnknownTraitsError.make({
        names: undefinedTraits,
        problem: `${WorkspaceLayout.environmentFile(selection.environment)} names traits without a ${WorkspaceLayout.traitFile("<name>")} file. Remove them from the environment or add their trait files.`
      })
    }
    selected = traits
  }
  if (selection.traits === undefined) {
    return selected
  }
  const unselected = missing(selection.traits, selected)
  if (unselected.length > 0) {
    return yield* UnknownTraitsError.make({
      names: unselected,
      problem:
        selection.environment === undefined
          ? `there is no ${WorkspaceLayout.traitFile("<name>")} file for them.`
          : `they are not in environment "${selection.environment}". Request traits it contains, or omit the environment.`
    })
  }
  return selection.traits
})

/** Parses a trait file's text and resolves its extension references relative to the file, which must be named for the trait. */
export const decode = Effect.fn("WorkspaceTraits.decode")(function* (name: TraitName, file: string, text: string) {
  const path = yield* Path.Path
  const { frontmatter, body } = yield* TraitFile.parse({ path: file, text })
  if (frontmatter.name !== name) {
    return yield* TraitFile.TraitFileParseError.make({
      path: file,
      problem: `its name is "${frontmatter.name}", but the file is named for "${name}".`
    })
  }
  // The file path is absolute, so it always converts to a URL.
  const baseUrl = yield* path.toFileUrl(file).pipe(Effect.orDie)
  const resolve = (reference: string) => ExtensionModule.resolve({ reference, baseUrl })
  const segment = frontmatter.segment === undefined ? undefined : yield* resolve(frontmatter.segment)
  const enrichments =
    frontmatter.enrichments === undefined
      ? undefined
      : // A trait lists few enrichments, and resolving one only locates a module file, so resolve them together.
        yield* Effect.all(Array.map(frontmatter.enrichments, resolve), { concurrency: "unbounded" })
  return Trait.make({
    name: frontmatter.name,
    purpose: frontmatter.purpose,
    ...(frontmatter.subject === undefined ? {} : { subject: frontmatter.subject }),
    ...(frontmatter.assertion === undefined ? {} : { assertion: frontmatter.assertion }),
    ...(segment === undefined ? {} : { segment }),
    ...(enrichments === undefined ? {} : { enrichments }),
    ...(body === undefined ? {} : { body })
  })
})

/** Loads .agents/traits/<name>.md and resolves its extension references relative to the file. */
export const load = Effect.fn("WorkspaceTraits.load")(function* (name: TraitName) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { directory } = yield* WorkspaceRoot
  const file = path.join(directory, WorkspaceLayout.traitFile(name))
  const text = yield* fs
    .readFileString(file)
    .pipe(Effect.mapError((cause) => TraitFileReadError.make({ path: file, cause })))
  return yield* decode(name, file, text)
})
