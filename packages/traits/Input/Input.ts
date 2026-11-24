import { type Effect, pipe, Schema as S, String } from "effect"

import { InputRange, whyInvalidTarget } from "./InputRange.ts"
import { InputSource } from "./InputSource.ts"

export * from "./InputRange.ts"
export * from "./InputSource.ts"

/** One primary before/after assessment target: a range of one source version. The version says whether the source is the current text or the text before the change, including deleted material. A target range is empty only when its source is. */
export type Input = typeof Input.Type
export const Input = S.Struct({
  /** The side of the change the source is: after for current text, before for text that was deleted or replaced. */
  version: S.Literals(["before", "after"]).annotateKey({
    description:
      "The side of the change the source is: after for current text, before for text that was deleted or replaced."
  }),
  /** The source version the range selects from. */
  source: InputSource.annotateKey({ description: "The source version the range selects from." }),
  /** The primary assessment range in the source's UTF-16 coordinates. */
  range: InputRange.annotateKey({ description: "The primary assessment range in the source's UTF-16 coordinates." })
})
  .annotate({
    description:
      "One primary before/after assessment target: a range of one source version. The version says whether the source is the current text or the text before the change, including deleted material. A target range is empty only when its source is."
  })
  .check(
    S.makeFilter((input) => {
      const issue = whyInvalidTarget(input.range, input.source.text)
      return issue === undefined ? undefined : { path: ["range"], issue }
    })
  )

// A source is already decoded, so it is validated against the decoded side.
const decodeInput = S.decodeUnknownEffect(S.toType(Input))

/** Validates a range against its source and constructs the input. */
export const select = (
  version: Input["version"],
  source: InputSource,
  range: InputRange
): Effect.Effect<Input, S.SchemaError> => decodeInput({ version, source, range })

/** Selected target text; the input must already satisfy the Input schema. */
export const targetText = (input: Input): string =>
  pipe(input.source.text, String.slice(input.range.start, input.range.end))
