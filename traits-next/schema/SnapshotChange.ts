import { Schema as S } from "effect"

import { Snapshot } from "./Snapshot.ts"

export type SnapshotChange = typeof SnapshotChange.Type
export const SnapshotChange = S.Union([
  S.Struct({
    /** The complete current snapshot, including unsaved changes. */
    current: Snapshot,
    /** The previous snapshot; omitted when the file is new. */
    previous: Snapshot.pipe(S.optional)
  }),
  S.Struct({
    /** No current snapshot exists for a deleted file. */
    current: S.Undefined.pipe(S.optional),
    /** The complete snapshot before deletion. */
    previous: Snapshot
  })
])
