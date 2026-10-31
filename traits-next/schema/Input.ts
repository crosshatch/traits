import { Array, Schema as S } from "effect"

import { Change } from "./Change.ts"
import { Segment } from "./Segment.ts"

/** A shared change and a segment validated against its source versions. */
export type Input = typeof Input.Type
export const Input = S.Struct({
  /** Available before and after source versions. */
  change: Change,
  /** The primary assessment target and optional historical context. */
  segment: Segment
}).check(
  S.makeFilter(
    (input) =>
      Segment.match(input.segment, {
        Before: (segment) => input.change.before !== undefined && segment.range.end <= input.change.before.text.length,
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
