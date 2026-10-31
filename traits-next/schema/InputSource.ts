import { Schema as S } from "effect"

/** One selected file version, independent of its lifecycle change. */
export type InputSource = typeof InputSource.Type
export const InputSource = S.Struct({
  /** The file path for this version. */
  path: S.NonEmptyString,
  /** The complete decoded text of this version. */
  text: S.String
})
