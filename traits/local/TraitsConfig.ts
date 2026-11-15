import { Array, Effect, FileSystem, Path, pipe, Schema as S, String } from "effect"

import PackageJson from "../package.json" with { type: "json" }
import { Settings } from "../Settings.ts"
import * as Version from "../Version.ts"
import { Models } from "./Models.ts"
import * as WorkspaceLayout from "./WorkspaceLayout.ts"
import { WorkspaceRoot } from "./WorkspaceRoot.ts"

/** The workspace configuration in traits.json at the workspace root: plain JSON, so it loads without executing code or installing JavaScript dependencies. Every .agents/traits/<name>.md file is a trait; environments narrow which are checked. Unknown keys are rejected so outdated files are reported rather than misread. */
export type TraitsConfig = typeof TraitsConfig.Type
export const TraitsConfig = S.Struct({
  /** A JSON Schema URL for editor validation and completion; ignored by traits. */
  $schema: S.String.annotateKey({
    description: "A JSON Schema URL for editor validation and completion; ignored by traits."
  }).pipe(S.optionalKey),
  /** The traits version this workspace's configuration and trait files were last migrated to, or "internal" in the traits repository itself, which always matches its own source. */
  version: S.Union([Version.Version, S.Literal("internal")]).annotateKey({
    description:
      'The traits version this workspace\'s configuration and trait files were last migrated to, or "internal" in the traits repository itself, which always matches its own source.'
  }),
  models: Models,
  /** Git glob patterns, relative to the workspace root, for files to skip when checking every project file, such as lockfiles or large generated assets; none when omitted. Explicitly requested paths are always checked. */
  exclude: S.Array(S.NonEmptyString)
    .pipe(S.withDecodingDefaultKey(Effect.succeed([])))
    .annotateKey({
      description:
        "Git glob patterns, relative to the workspace root, for files to skip when checking every project file, such as lockfiles or large generated assets; none when omitted. Explicitly requested paths are always checked."
    }),
  ...Settings.fields
}).annotate({
  description:
    "The workspace configuration in traits.json at the workspace root: plain JSON, so it loads without executing code or installing JavaScript dependencies."
})

/** The configuration file could not be read. */
export class TraitsConfigReadError extends S.TaggedError<TraitsConfigReadError>()("TraitsConfigReadError", {
  /** The configuration file path. */
  path: S.String.annotateKey({ description: "The configuration file path." }),
  /** The underlying filesystem failure. */
  cause: S.Defect().annotateKey({ description: "The underlying filesystem failure." })
}) {
  override get message(): string {
    return `Could not read ${this.path}. Create it at the workspace root with a version and models for language and decision.`
  }
}

/** The configuration file is not valid JSON. */
export class TraitsConfigSyntaxError extends S.TaggedError<TraitsConfigSyntaxError>()("TraitsConfigSyntaxError", {
  /** The configuration file path. */
  path: S.String.annotateKey({ description: "The configuration file path." }),
  /** The JSON parser's failure, with the position of the problem. */
  cause: S.Defect().annotateKey({ description: "The JSON parser's failure, with the position of the problem." })
}) {
  override get message(): string {
    return `${this.path} is not valid JSON: ${this.cause instanceof Error ? this.cause.message : globalThis.String(this.cause)}. Fix the syntax there; traits.json is plain JSON, without comments or trailing commas.`
  }
}

/** The configuration file is valid JSON but does not match the current schema. */
export class TraitsConfigDecodeError extends S.TaggedError<TraitsConfigDecodeError>()("TraitsConfigDecodeError", {
  /** The configuration file path. */
  path: S.String.annotateKey({ description: "The configuration file path." }),
  /** The schema validation failure. */
  cause: S.Defect().annotateKey({ description: "The schema validation failure." })
}) {
  override get message(): string {
    return `${this.path} does not match the schema expected by traits ${PackageJson.version}: ${globalThis.String(this.cause)}\nIf it was written for an earlier version, run \`traits update\` and follow its migration steps.`
  }
}

/** The configuration file was written for a traits version incompatible with the installed one. */
export class TraitsConfigVersionError extends S.TaggedError<TraitsConfigVersionError>()("TraitsConfigVersionError", {
  /** The configuration file path. */
  path: S.String.annotateKey({ description: "The configuration file path." }),
  /** The version recorded in the configuration. */
  configured: S.String.annotateKey({ description: "The version recorded in the configuration." }),
  /** The installed traits version. */
  installed: S.String.annotateKey({ description: "The installed traits version." })
}) {
  override get message(): string {
    return Version.status(this.configured, this.installed) === "Newer"
      ? `${this.path} requires traits ${this.configured}, but ${this.installed} is installed. Upgrade traits before checking.`
      : `${this.path} was migrated for traits ${this.configured}, but ${this.installed} is installed and may read configuration or trait files differently. Run \`traits update\` and follow its migration steps for ${this.path} and every trait file.`
  }
}

/** The configuration claims to be the traits repository's own, but traits is installed as a dependency. */
export class TraitsConfigInternalVersionError extends S.TaggedError<TraitsConfigInternalVersionError>()(
  "TraitsConfigInternalVersionError",
  {
    /** The configuration file path. */
    path: S.String.annotateKey({ description: "The configuration file path." }),
    /** The installed traits version. */
    installed: S.String.annotateKey({ description: "The installed traits version." })
  }
) {
  override get message(): string {
    return `${this.path} sets version to "internal", which only the traits repository uses, for checks run from its own source. Set version to the traits version this workspace was migrated to, such as ${this.installed}.`
  }
}

/** Reads only the version from traits.json at the workspace root, since the rest may not match the current schema yet; undefined when the file is missing or its version is invalid. */
export const loadVersion = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { directory } = yield* WorkspaceRoot
  const file = path.join(directory, WorkspaceLayout.config)
  if (!(yield* fs.exists(file))) {
    return undefined
  }
  return yield* fs.readFileString(file).pipe(
    Effect.flatMap((text) =>
      pipe(
        text,
        S.decodeEffect(S.fromJsonString(S.Struct({ version: TraitsConfig.fields.version }))),
        Effect.map((config) => config.version),
        Effect.orElseSucceed(() => undefined)
      )
    )
  )
})

/** Loads and validates traits.json from the workspace root, failing when it was written for an incompatible traits version. */
export const load = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { directory } = yield* WorkspaceRoot
  const file = path.join(directory, WorkspaceLayout.config)
  const text = yield* fs
    .readFileString(file)
    .pipe(Effect.mapError((cause) => TraitsConfigReadError.make({ path: file, cause })))
  // JSON.parse's own error gives the position of a syntax error, which a schema's JSON decoding does not.
  const json = yield* Effect.try({
    try: (): unknown => JSON.parse(text),
    catch: (cause) => TraitsConfigSyntaxError.make({ path: file, cause })
  })
  const config = yield* pipe(
    json,
    S.decodeUnknownEffect(TraitsConfig, { onExcessProperty: "error" }),
    Effect.mapError((cause) => TraitsConfigDecodeError.make({ path: file, cause }))
  )
  if (config.version === "internal") {
    // Only the traits repository runs traits from source inside its own workspace; a dependency lives in node_modules.
    const source = yield* fs.realPath(path.join(import.meta.dirname, "..")).pipe(Effect.orElseSucceed(() => ""))
    const relative = path.relative(directory, source)
    const withinWorkspace =
      source !== "" &&
      !path.isAbsolute(relative) &&
      !pipe(relative, String.startsWith("..")) &&
      !pipe(source, String.split(path.sep), Array.contains("node_modules"))
    return withinWorkspace
      ? config
      : yield* TraitsConfigInternalVersionError.make({ path: file, installed: PackageJson.version })
  }
  if (Version.status(config.version, PackageJson.version) !== "Compatible") {
    return yield* TraitsConfigVersionError.make({
      path: file,
      configured: config.version,
      installed: PackageJson.version
    })
  }
  return config
}).pipe(Effect.withSpan("TraitsConfig.load"))
