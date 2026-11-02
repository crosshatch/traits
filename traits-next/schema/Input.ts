import { Array, Schema as S } from "effect"

import { isSurrogatePairBoundary } from "../util/index.ts"
import { Change } from "./Change.ts"
import type { InputRange } from "./InputRange.ts"
import { Segment } from "./Segment.ts"

const isSourceRange = (text: string, range: InputRange): boolean =>
  range.end <= text.length && isSurrogatePairBoundary(text, range.start) && isSurrogatePairBoundary(text, range.end)

/** A change and assessment segment with source-presence, UTF-16 bounds, and surrogate-pair boundary validation; validation does not establish diff correspondence. */
export type Input = typeof Input.Type
export const Input = S.Struct({
  /** The available before and after sources, retained as context for enrichment and assessment. */
  change: Change.annotateKey({
    description: "The available before and after sources, retained as context for enrichment and assessment."
  }),
  /** The primary assessment target and optional historical mappings, validated against the available sources. */
  segment: Segment.annotateKey({
    description:
      "The primary assessment target and optional historical mappings, validated against the available sources."
  })
})
  .annotate({
    description:
      "A change and assessment segment with source-presence, UTF-16 bounds, and surrogate-pair boundary validation; validation does not establish diff correspondence."
  })
  .check(
    S.makeFilter(
      (input) =>
        Segment.match(input.segment, {
          Before: (segment) =>
            input.change.before !== undefined && isSourceRange(input.change.before.text, segment.range),
          After: (segment) =>
            input.change.after !== undefined &&
            isSourceRange(input.change.after.text, segment.range) &&
            (segment.before === undefined ||
              Array.every(
                segment.before,
                (range) => input.change.before !== undefined && isSourceRange(input.change.before.text, range)
              ))
        }),
      {
        message:
          "Selected ranges must refer to available source versions, fit within their UTF-16 lengths, and not split surrogate pairs."
      }
    )
  )
