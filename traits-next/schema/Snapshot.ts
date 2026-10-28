import { Schema as S } from "effect"

import { SnapshotChange } from "./SnapshotChange.ts"

/** A file's path and complete creation, update, or deletion contents. */
export type Snapshot = typeof Snapshot.Type
export const Snapshot = S.Struct({
  /** The current file path, or its last path before deletion. */
  path: S.NonEmptyString,
  /** The change kind and its complete text versions. */
  change: SnapshotChange
})
