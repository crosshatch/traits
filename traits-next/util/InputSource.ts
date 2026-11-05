import { Schema as S } from "effect"

/** One text-only file version with its own path and complete contents. */
export type InputSource = typeof InputSource.Type
export const InputSource = S.Struct({
  /** The file path for this source version, including historical or renamed paths. */
  path: S.NonEmptyString.annotate({
    description: "The file path for this source version, including historical or renamed paths."
  }),
  /** The complete decoded text of this source version. */
  text: S.String.annotate({ description: "The complete decoded text of this source version." })
}).annotate({ description: "One text-only file version with its own path and complete contents." })
