import { Schema as S } from "effect"

/** Zero-based UTF-16 offsets with an exclusive end. */
export type InputRange = typeof InputRange.Type
export const InputRange = S.Struct({
  /** Inclusive starting offset. */
  start: S.Natural,
  /** Exclusive ending offset. */
  end: S.Natural
}).check(
  S.makeFilter((range) => range.end >= range.start, {
    message: "Range end must not precede its start."
  })
)
