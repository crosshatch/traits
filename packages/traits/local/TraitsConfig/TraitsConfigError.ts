import { Schema as S, SemVer } from "effect"

import PackageJson from "../../package.json" with { type: "json" }

/** Why the workspace configuration could not be loaded. */
export const TraitsConfigErrorReason = S.TaggedUnion({
  /** No configuration file exists yet. It is never created implicitly, because choosing its models is the user's decision. */
  Missing: {},
  /** The file exists but could not be read. */
  Unreadable: {},
  /** The file is not valid JSON. */
  InvalidJson: {},
  /** The file is JSON but does not match the configuration schema, such as an unknown key. */
  InvalidSchema: {
    /** The schema issues describing each invalid or unknown key. */
    error: S.instanceOf(S.SchemaError).annotateKey({
      description: "The schema issues describing each invalid or unknown key."
    })
  },
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
      Missing: () => `No traits configuration at ${this.path}.`,
      Unreadable: () => `Could not read ${this.path}.`,
      InvalidJson: () => `${this.path} is not valid JSON.`,
      InvalidSchema: () => `${this.path} is not a valid traits configuration.`,
      IncompatibleVersion: ({ configured }) =>
        `${this.path} is configured for traits ${SemVer.format(configured)}, which is not compatible with the installed ${PackageJson.version}.`
    })
  }
}
