import { Schema as S } from "effect"

export type TraitInputSnapshot = typeof TraitInputSnapshot.Type
export const TraitInputSnapshot = S.Struct({
  /** The file path at this snapshot, which may differ across a rename. */
  path: S.NonEmptyString,
  /** The complete text of this snapshot. */
  text: S.String
})

export type TraitInput = typeof TraitInput.Type
export const TraitInput = S.Union([
  S.Struct({
    /** The complete current snapshot, including unsaved changes. */
    current: TraitInputSnapshot,
    /** The previous snapshot; omitted when the file is new. */
    previous: TraitInputSnapshot.pipe(S.optional)
  }),
  S.Struct({
    /** No current snapshot exists for a deleted file. */
    current: S.Undefined.pipe(S.optional),
    /** The complete snapshot before deletion. */
    previous: TraitInputSnapshot
  })
])
