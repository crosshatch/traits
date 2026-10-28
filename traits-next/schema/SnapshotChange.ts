import { Schema as S } from "effect"

import { SnapshotContent } from "./SnapshotContent.ts"

/** Complete contents for a file creation, update, or deletion. */
export type SnapshotChange = typeof SnapshotChange.Type
export const SnapshotChange = S.TaggedUnion({
  Created: {
    /** The complete contents of the new file. */
    content: SnapshotContent
  },
  Updated: {
    /** The path before the update, which may differ after a rename. */
    previousPath: S.NonEmptyString,
    /** The complete contents before the update. */
    previous: SnapshotContent,
    /** The complete contents after the update, including unsaved changes. */
    current: SnapshotContent
  },
  Deleted: {
    /** The complete contents before deletion. */
    content: SnapshotContent
  }
})
