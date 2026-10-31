import { Schema as S } from "effect"

import { InputRange } from "./InputRange.ts"

/** A primary assessment range and optional mapped historical context. */
export type Segment = typeof Segment.Type
export const Segment = S.TaggedUnion({
  Before: {
    /** The primary range within the before-source text. */
    range: InputRange
  },
  After: {
    /** The primary range within the after-source text. */
    range: InputRange,
    /** Mapped before-ranges; omitted means unknown, empty means no counterpart. */
    before: S.Array(InputRange).pipe(S.optionalKey)
  }
})
