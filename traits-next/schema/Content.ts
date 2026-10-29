import { Schema as S } from "effect"

/** Text or binary contents, independent of file format. */
export type Content = typeof Content.Type
export const Content = S.TaggedUnion({
  Text: {
    /** The complete decoded text. */
    text: S.String
  },
  Binary: {
    /** The complete file bytes. */
    data: S.Uint8Array
  }
})
