import { Schema as S } from "effect"

import { Content } from "./Content.ts"
import { InputSegment } from "./InputSegment.ts"
import { InputSource } from "./InputSource.ts"

/** A source version and a segment validated against its complete contents. */
export type InputLocation = typeof InputLocation.Type
export const InputLocation = S.Struct({
  /** The selected file version, including its path and complete contents. */
  source: InputSource,
  /** The complete source or a valid range within its decoded text. */
  location: InputSegment
}).check(
  S.makeFilter(
    (input) =>
      InputSegment.guards.Full(input.location) ||
      (Content.guards.Text(input.source.content) && input.location.range.end <= input.source.content.text.length),
    { message: "A range must refer to text and fit within the source's UTF-16 length." }
  )
)
