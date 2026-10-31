import { Schema as S } from "effect"

import { InputRange } from "./InputRange.ts"
import { InputSource } from "./InputSource.ts"

/** A source version and a range validated against its complete text. */
export type Input = typeof Input.Type
export const Input = S.Struct({
  /** The selected file version, including its path and complete contents. */
  source: InputSource,
  /** The selected UTF-16 range; zero to text length selects the complete source. */
  range: InputRange
}).check(
  S.makeFilter((input) => input.range.end <= input.source.text.length, {
    message: "A range must fit within the source's UTF-16 length."
  })
)
