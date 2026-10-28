import { Schema as S } from "effect"

/** Complete text for a file creation, update, or deletion. */
export type SnapshotChange = typeof SnapshotChange.Type
export const SnapshotChange = S.TaggedUnion({
  Created: {
    /** The complete text of the new file. */
    text: S.String
  },
  Updated: {
    /** The path before the update, which may differ after a rename. */
    previousPath: S.NonEmptyString,
    /** The complete text before the update. */
    previousText: S.String,
    /** The complete text after the update, including unsaved changes. */
    currentText: S.String
  },
  Deleted: {
    /** The complete text before deletion. */
    text: S.String
  }
})
