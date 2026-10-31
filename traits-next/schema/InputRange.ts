import { Schema as S } from "effect"

/** An ordered UTF-16 text range; [0, text.length) selects the whole source, including [0, 0) for empty text. */
export type InputRange = typeof InputRange.Type
export const InputRange = S.Struct({
  /** Inclusive starting offset in zero-based UTF-16 code units. */
  start: S.Natural.annotate({ description: "Inclusive starting offset in zero-based UTF-16 code units." }),
  /** Exclusive ending offset in UTF-16 code units, at least the starting offset. */
  end: S.Natural.annotate({
    description: "Exclusive ending offset in UTF-16 code units, at least the starting offset."
  })
})
  .annotate({
    description:
      "An ordered UTF-16 text range; [0, text.length) selects the whole source, including [0, 0) for empty text."
  })
  .check(
    S.makeFilter((range) => range.end >= range.start, {
      message: "Range end must not precede its start."
    })
  )
