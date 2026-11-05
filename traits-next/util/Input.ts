import { Array, type Effect, Function, pipe, Schema as S, String, Struct } from "effect"

import { Change, ChangeWithAfter, ChangeWithBefore } from "./Change.ts"
import { isValidForText } from "./InputRange.ts"
import { Segment } from "./Segment.ts"

/** A before/after target paired with its required source; ranges use validated UTF-16 boundaries, without inferred diff correspondence. */
export type Input = typeof Input.Type
const invalidRange =
  "Selected ranges must refer to available source versions, fit within their UTF-16 lengths, and not split surrogate pairs."
const BeforeInput = S.Struct({
  ...Segment.cases.Before.fields,
  /** Available source versions, including the required primary before source. */
  change: ChangeWithBefore.annotateKey({
    description: "Available source versions, including the required primary before source."
  })
}).check(S.makeFilter((input) => isValidForText(input.range, input.change.before.text), { message: invalidRange }))
const AfterInput = S.Struct({
  ...Segment.cases.After.fields,
  /** Available source versions, including the required primary after source. */
  change: ChangeWithAfter.annotateKey({
    description: "Available source versions, including the required primary after source."
  })
}).check(
  S.makeFilter(
    (input) =>
      isValidForText(input.range, input.change.after.text) &&
      (input.before === undefined ||
        Array.every(
          input.before,
          (range) => input.change.before !== undefined && isValidForText(range, input.change.before.text)
        )),
    { message: invalidRange }
  )
)
export const Input = S.Union([BeforeInput, AfterInput])
  .annotate({
    description:
      "A before/after target paired with its required source; ranges use validated UTF-16 boundaries, without inferred diff correspondence."
  })
  .pipe(S.toTaggedUnion("_tag"))

/** Validates a segment against its source versions and constructs the corresponding input variant. */
export const fromSegment: {
  (segment: Segment): (change: Change) => Effect.Effect<Input, S.SchemaError>
  (change: Change, segment: Segment): Effect.Effect<Input, S.SchemaError>
} = Function.dual(2, (change: Change, segment: Segment) => pipe({ ...segment, change }, S.decodeUnknownEffect(Input)))

/** Source-free segment representation used by reports and segmenter results. */
export const toSegment = (input: Input): Segment => Struct.omit(input, ["change"])

/** Selected primary source text; the input must already satisfy the Input schema. */
export const targetText = (input: Input): string =>
  Input.match(input, {
    Before: (input) => pipe(input.change.before.text, String.slice(input.range.start, input.range.end)),
    After: (input) => pipe(input.change.after.text, String.slice(input.range.start, input.range.end))
  })
