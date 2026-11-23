import { Schema as S } from "effect"

/** Why something a workspace keeps, such as its configuration, its traits, or its project's files, could not be read or written. */
export const StorageErrorReason = S.TaggedUnion({
  /** The stored data does not exist. */
  Missing: {},
  /** The stored data exists but could not be read. */
  Unreadable: {},
  /** The stored data is not valid, such as invalid JSON or a trait file with invalid frontmatter. */
  Malformed: {},
  /** A collection's stored traits have not been brought up to date since its source was declared or last changed. */
  NotUpdated: {},
  /** A collection's stored traits were changed after they were last brought up to date with its source. */
  Modified: {},
  /** The data could not be written. */
  Unwritable: {}
}).annotate({
  description:
    "Why something a workspace keeps, such as its configuration, its traits, or its project's files, could not be read or written."
})

/** Something a workspace keeps, such as its configuration, its traits, or its project's files, could not be read or written. Handle a specific reason with Effect.catchReason("StorageError", ...). */
export class StorageError extends S.TaggedError<StorageError>()("StorageError", {
  /** What could not be read or written, such as the path of the configuration file, a trait file, a collection's directory, or a project file. */
  location: S.String.annotateKey({
    description:
      "What could not be read or written, such as the path of the configuration file, a trait file, a collection's directory, or a project file."
  }),
  reason: StorageErrorReason,
  /** The underlying failure, when there is one: the storage error, the parser's error, or the schema issues. */
  cause: S.Defect()
    .annotateKey({
      description:
        "The underlying failure, when there is one: the storage error, the parser's error, or the schema issues."
    })
    .pipe(S.optionalKey)
}) {
  override get message() {
    return StorageErrorReason.match(this.reason, {
      Missing: () => `${this.location} does not exist.`,
      Unreadable: () => `Could not read ${this.location}.`,
      Malformed: () => `${this.location} is not valid.`,
      NotUpdated: () =>
        `${this.location} has not been updated since its source was declared or last changed; update the collection.`,
      Modified: () =>
        `${this.location} was changed after it was last updated from its source; update the collection to restore it.`,
      Unwritable: () => `Could not write ${this.location}.`
    })
  }
}
