import { Array, Schema as S } from "effect"

import { InputRange } from "./InputRange.ts"

/** One primary before/after assessment target, with optional historical context for an after target. */
export type Segment = typeof Segment.Type
export const Segment = S.TaggedUnion({
  Before: {
    /** The primary assessment range in before-source UTF-16 coordinates, including deleted material. */
    range: InputRange.annotateKey({
      description: "The primary assessment range in before-source UTF-16 coordinates, including deleted material."
    })
  },
  After: {
    /** The primary assessment range in after-source UTF-16 coordinates. */
    range: InputRange.annotateKey({ description: "The primary assessment range in after-source UTF-16 coordinates." }),
    /** Diff-associated ranges in before-source coordinates, in ascending order without overlap, used as context rather than separate targets. Omitted or undefined means correspondence unknown; empty means no counterpart. */
    before: S.Array(InputRange)
      .annotate({
        description:
          "Diff-associated ranges in before-source coordinates, in ascending order without overlap, used as context rather than separate targets. Omitted or undefined means correspondence unknown; empty means no counterpart."
      })
      .check(
        S.makeFilter((ranges) =>
          Array.flatMap(ranges, (range, index) => {
            const previous = ranges[index - 1]
            return previous !== undefined && range.start < previous.end
              ? [
                  {
                    path: [index],
                    issue: `Before ranges must be in ascending order without overlap, but this one starts at ${range.start}, before the previous one ends at ${previous.end}.`
                  }
                ]
              : []
          })
        )
      )
      // A segment is as often built in code as it is decoded, so an explicit undefined is accepted as omitted.
      .pipe(S.optional)
  }
}).annotate({
  description: "One primary before/after assessment target, with optional historical context for an after target."
})
