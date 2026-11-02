import { Array, Schema as S } from "effect"

import { Change } from "./Change.ts"
import { isValidForText } from "./InputRange.ts"
import { Segment } from "./Segment.ts"

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
            input.change.before !== undefined && isValidForText(segment.range, input.change.before.text),
          After: (segment) =>
            input.change.after !== undefined &&
            isValidForText(segment.range, input.change.after.text) &&
            (segment.before === undefined ||
              Array.every(
                segment.before,
                (range) => input.change.before !== undefined && isValidForText(range, input.change.before.text)
              ))
        }),
      {
        message:
          "Selected ranges must refer to available source versions, fit within their UTF-16 lengths, and not split surrogate pairs."
      }
    )
  )
