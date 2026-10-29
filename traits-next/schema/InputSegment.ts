import { Schema as S } from "effect"

import { InputRange } from "./InputRange.ts"

/** A complete input version or a decoded-text range within it. */
export type InputSegment = typeof InputSegment.Type
export const InputSegment = S.TaggedUnion({
  Full: {},
  Range: {
    /** The selected range within this version's decoded text. */
    range: InputRange
  }
})
