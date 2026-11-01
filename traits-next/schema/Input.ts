import { Array, Schema as S } from "effect"

import { Change } from "./Change.ts"
import { Segment } from "./Segment.ts"

/** A change and assessment segment with source-presence and UTF-16 bounds validation; bounds do not establish diff correspondence. */
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
      "A change and assessment segment with source-presence and UTF-16 bounds validation; bounds do not establish diff correspondence."
  })
  .check(
    S.makeFilter(
      (input) =>
        Segment.match(input.segment, {
          Before: (segment) =>
            input.change.before !== undefined && segment.range.end <= input.change.before.text.length,
          After: (segment) =>
            input.change.after !== undefined &&
            segment.range.end <= input.change.after.text.length &&
            (segment.before === undefined ||
              Array.every(
                segment.before,
                (range) => input.change.before !== undefined && range.end <= input.change.before.text.length
              ))
        }),
      { message: "Selected ranges must refer to available source versions and fit within their UTF-16 lengths." }
    )
  )
