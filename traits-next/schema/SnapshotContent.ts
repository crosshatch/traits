import { Schema as S } from "effect"

/** A snapshot's text or binary contents, independent of its file format. */
export type SnapshotContent = typeof SnapshotContent.Type
export const SnapshotContent = S.TaggedUnion({
  Text: {
    /** The complete decoded text. */
    text: S.String
  },
  Binary: {
    /** The complete file bytes. */
    data: S.Uint8Array
  }
})
