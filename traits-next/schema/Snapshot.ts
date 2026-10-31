import { Schema as S } from "effect"

import { InputSource } from "./InputSource.ts"

/** A file creation, update, or deletion containing its complete source versions. */
export type Snapshot = typeof Snapshot.Type
export const Snapshot = S.TaggedUnion({
  Created: {
    /** The newly created source. */
    source: InputSource
  },
  Updated: {
    /** The source before the update, including its previous path. */
    previous: InputSource,
    /** The source after the update, including renames and unsaved changes. */
    current: InputSource
  },
  Deleted: {
    /** The last source version before deletion. */
    source: InputSource
  }
})
