import { Schema as S } from "effect"

export type Snapshot = typeof Snapshot.Type
export const Snapshot = S.Struct({
  /** The file path at this snapshot, which may differ across a rename. */
  path: S.NonEmptyString,
  /** The complete text of this snapshot. */
  text: S.String
})
