import { Function, Option, Schema as S, String } from "effect"

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

/** Why a range cannot select from the text, or undefined when it can: it needs nonnegative, ordered integer offsets that end within the text and do not split surrogate pairs. */
export const whyInvalidForText: {
  (text: string): (range: InputRange) => string | undefined
  (range: InputRange, text: string): string | undefined
} = Function.dual(2, (range: InputRange, text: string): string | undefined => {
  if (!S.is(InputRange)(range)) {
    return "Expected nonnegative integer offsets with the end at or after the start."
  }
  if (range.end > text.length) {
    return `The range ends at ${range.end}, past the end of the text at ${text.length}.`
  }
  // An offset splits a pair when the code point starting just before it needs two UTF-16 code units.
  const splits = (offset: number) => Option.exists(String.codePointAt(text, offset - 1), (code) => code > 0xffff)
  if (splits(range.start)) {
    return `The range start ${range.start} splits a surrogate pair.`
  }
  if (splits(range.end)) {
    return `The range end ${range.end} splits a surrogate pair.`
  }
  return undefined
})

/** Whether a range has nonnegative, ordered integer offsets and fits the text without splitting surrogate pairs. */
export const isValidForText: {
  (text: string): (range: InputRange) => boolean
  (range: InputRange, text: string): boolean
} = Function.dual(2, (range: InputRange, text: string): boolean => whyInvalidForText(range, text) === undefined)
