import { Effect, FileSystem, pipe, Schema as S, SemVer, SemVerRange } from "effect"

import PackageJson from "../package.json" with { type: "json" }
import { ModelConfiguration } from "./ModelConfiguration.ts"
import { setupGuide, WorkspacePaths } from "./WorkspacePaths.ts"

/** The workspace configuration in traits/config.json: plain JSON, so it loads without executing code or installing JavaScript dependencies. Every traits/<name>.md file is a trait; traits/lists.json groups them. Unknown keys are rejected so outdated files are reported rather than misread. */
export type TraitsConfig = typeof TraitsConfig.Type
export const TraitsConfig = S.Struct({
  /** A JSON Schema URL for editor validation and completion; ignored by traits. */
  $schema: S.String.annotateKey({
    description: "A JSON Schema URL for editor validation and completion; ignored by traits."
  }).pipe(S.optionalKey),
  /** The traits version this workspace's configuration and trait files were last migrated to. */
  version: S.SemVerFromString.annotateKey({
    description: "The traits version this workspace's configuration and trait files were last migrated to."
  }),
  models: ModelConfiguration,
  /** Git glob patterns, relative to the workspace root, for files to skip when checking every project file, such as lockfiles or large generated assets; none when omitted. Explicitly requested paths are always checked. */
  exclude: S.Array(S.NonEmptyString)
    .annotateKey({
      description:
        "Git glob patterns, relative to the workspace root, for files to skip when checking every project file, such as lockfiles or large generated assets; none when omitted. Explicitly requested paths are always checked."
    })
    .pipe(S.withDecodingDefaultKey(Effect.succeed([])))
}).annotate({
  description:
    "The workspace configuration in traits/config.json: plain JSON, so it loads without executing code or installing JavaScript dependencies. Every traits/<name>.md file is a trait; traits/lists.json groups them. Unknown keys are rejected so outdated files are reported rather than misread."
})

/** Why the workspace configuration could not be loaded. */
export const TraitsConfigErrorReason = S.TaggedUnion({
  /** No configuration file exists yet. It is never created implicitly, because choosing its models is the user's decision. */
  Missing: {},
  /** The file exists but could not be read. */
  Unreadable: {},
  /** The file is not valid JSON. */
  InvalidJson: {},
  /** The file is JSON but does not match the configuration schema, such as an unknown key. */
  Invalid: {},
  /** The installed traits version is not compatible with the configured one. */
  IncompatibleVersion: {
    /** The version the workspace was last migrated to. */
    configured: S.SemVerFromString.annotateKey({ description: "The version the workspace was last migrated to." })
  }
}).annotate({ description: "Why the workspace configuration could not be loaded." })

/** The workspace configuration could not be loaded. Handle a specific reason with Effect.catchReason("TraitsConfigError", ...). */
export class TraitsConfigError extends S.TaggedError<TraitsConfigError>()("TraitsConfigError", {
  /** The configuration file the failure concerns. */
  path: S.String.annotateKey({ description: "The configuration file the failure concerns." }),
  reason: TraitsConfigErrorReason,
  /** The underlying failure, when there is one: the file system error, the JSON parser's error with the position of the syntax error, or the schema issues. */
  cause: S.Defect()
    .annotateKey({
      description:
        "The underlying failure, when there is one: the file system error, the JSON parser's error with the position of the syntax error, or the schema issues."
    })
    .pipe(S.optionalKey)
}) {
  override get message() {
    return TraitsConfigErrorReason.match(this.reason, {
      Missing: () => `No traits configuration at ${this.path}. To create one, see ${setupGuide}.`,
      Unreadable: () => `Could not read ${this.path}.`,
      InvalidJson: () => `${this.path} is not valid JSON.`,
      Invalid: () => `${this.path} is not a valid traits configuration.`,
      IncompatibleVersion: ({ configured }) =>
        `${this.path} is configured for traits ${SemVer.format(configured)}, which is not compatible with the installed ${PackageJson.version}.`
    })
  }
}

/** Loads and validates traits/config.json, failing when it was written for an incompatible traits version. */
export const load = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const paths = yield* WorkspacePaths
  const text = yield* fs.readFileString(paths.config).pipe(
    Effect.catchReason(
      "PlatformError",
      "NotFound",
      () => TraitsConfigError.make({ path: paths.config, reason: { _tag: "Missing" } }),
      (_, cause) => TraitsConfigError.make({ path: paths.config, reason: { _tag: "Unreadable" }, cause })
    )
  )
  // JSON.parse's own error gives the position of a syntax error, which a schema's JSON decoding does not.
  const json = yield* Effect.try({
    try: () => JSON.parse(text),
    catch: (cause) => TraitsConfigError.make({ path: paths.config, reason: { _tag: "InvalidJson" }, cause })
  })
  const config = yield* pipe(
    json,
    S.decodeUnknownEffect(TraitsConfig, { onExcessProperty: "error" }),
    Effect.mapError((cause) => TraitsConfigError.make({ path: paths.config, reason: { _tag: "Invalid" }, cause }))
  )
  // The installed version must satisfy ^configured: ^1.2.3 allows 1.x.y, ^0.2.3 allows 0.2.y, and ^0.0.3 allows only 0.0.3.
  if (
    !SemVerRange.matches(SemVerRange.caret(config.version), SemVer.parseUnsafe(PackageJson.version), {
      includePrerelease: true
    })
  ) {
    return yield* TraitsConfigError.make({
      path: paths.config,
      reason: { _tag: "IncompatibleVersion", configured: config.version }
    })
  }
  return config
}).pipe(Effect.withSpan("TraitsConfig.load"))
