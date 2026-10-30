import { Schema as S } from "effect"

import { Content } from "./Content.ts"

/** One selected file version, independent of its lifecycle change. */
export type InputSource = typeof InputSource.Type
export const InputSource = S.Struct({
  /** The file path for this version. */
  path: S.NonEmptyString,
  /** The complete contents of this version. */
  content: Content
})
