import { Array, type Effect, Function, pipe, Schema as S, String } from "effect"

import { Change, ChangeWithAfter, ChangeWithBefore } from "./Change.ts"
import { type InputRange, whyInvalidForText } from "./InputRange.ts"
import type { InputSource } from "./InputSource.ts"
import { Segment } from "./Segment.ts"

export * from "./Change.ts"
export * from "./InputRange.ts"
export * from "./InputSource.ts"
export * from "./Segment.ts"

/** The issue with a range that must select from the text, reported at the range's own path. */
const rangeIssues = (path: ReadonlyArray<PropertyKey>, range: InputRange, text: string): Array<S.FilterIssue> => {
  const issue = whyInvalidForText(range, text)
  return issue === undefined ? [] : [{ path, issue }]
}

/** Issues with a primary target, which must also select something unless its source is empty. */
const targetIssues = (range: InputRange, text: string): Array<S.FilterIssue> => [
  ...rangeIssues(["segment", "range"], range, text),
  ...(range.start === range.end && text.length > 0
    ? [{ path: ["segment", "range"], issue: "The target range is empty, which is only allowed for an empty source." }]
    : [])
]

const BeforeInput = S.TaggedStruct("Before", {
  /** Available source versions, including the required primary before source. */
  change: ChangeWithBefore.annotateKey({
    description: "Available source versions, including the required primary before source."
  }),
  /** The primary assessment target in the before source. */
  segment: Segment.cases.Before.annotateKey({ description: "The primary assessment target in the before source." })
}).check(S.makeFilter((input) => targetIssues(input.segment.range, input.change.before.text)))

const AfterInput = S.TaggedStruct("After", {
  /** Available source versions, including the required primary after source. */
  change: ChangeWithAfter.annotateKey({
    description: "Available source versions, including the required primary after source."
  }),
  /** The primary assessment target in the after source, with optional historical context. */
  segment: Segment.cases.After.annotateKey({
    description: "The primary assessment target in the after source, with optional historical context."
  })
}).check(
  S.makeFilter((input) => {
    const context = input.segment.before ?? []
    const before = input.change.before
    return [
      ...targetIssues(input.segment.range, input.change.after.text),
      ...(before === undefined
        ? Array.isReadonlyArrayNonEmpty(context)
          ? [{ path: ["segment", "before"], issue: "The change has no before source for these ranges to select from." }]
          : []
        : Array.flatMap(context, (range, index) => rangeIssues(["segment", "before", index], range, before.text)))
    ]
  })
)

/** A segment paired with the change it selects from; the tag matches the segment's, so the selected source side is present in both the schema and the static type. Ranges use validated UTF-16 boundaries, without inferred diff correspondence, and a target range is empty only when its source is. */
export type Input = typeof Input.Type
export const Input = S.Union([BeforeInput, AfterInput])
  .annotate({
    description:
      "A segment paired with the change it selects from; the tag matches the segment's, so the selected source side is present in both the schema and the static type. Ranges use validated UTF-16 boundaries, without inferred diff correspondence, and a target range is empty only when its source is."
  })
  .pipe(S.toTaggedUnion("_tag"))

// A change and segment are already decoded, so they are validated against the decoded side.
const DecodedInput = S.toType(Input)

/** Validates a segment against its source versions and constructs the corresponding input variant. */
export const fromSegment: {
  (segment: Segment): (change: Change) => Effect.Effect<Input, S.SchemaError>
  (change: Change, segment: Segment): Effect.Effect<Input, S.SchemaError>
} = Function.dual(2, (change: Change, segment: Segment) =>
  pipe({ _tag: segment._tag, change, segment }, S.decodeUnknownEffect(DecodedInput))
)

/** The source version an input's segment selects from: before for a Before input, after for an After input. */
export const primarySource = (input: Input): InputSource =>
  Input.match(input, { Before: (input) => input.change.before, After: (input) => input.change.after })

/** Selected primary source text; the input must already satisfy the Input schema. */
export const targetText = (input: Input): string =>
  pipe(primarySource(input).text, String.slice(input.segment.range.start, input.segment.range.end))
