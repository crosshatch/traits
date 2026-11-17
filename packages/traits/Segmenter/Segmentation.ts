import { Array, Effect, Function, Order, Schema as S } from "effect"

import type { Change } from "../util/Change.ts"
import { fromSegment, Input } from "../util/Input.ts"
import { Segment } from "../util/Segment.ts"

const segmentOrder = Order.make<Input>(
  (left, right) =>
    Order.Number(Input.guards.Before(left) ? 0 : 1, Input.guards.Before(right) ? 0 : 1) ||
    Order.Number(left.segment.range.start, right.segment.range.start) ||
    Order.Number(left.segment.range.end, right.segment.range.end)
)

/** Segments one change into unvalidated segments, as a segmenter's execution does. */
type SegmentChange<E, R> = (change: Change) => Effect.Effect<ReadonlyArray<Segment>, E, R>

/** Rejects the whole result if any segment is invalid for its source, then orders targets deterministically. */
export const execute: {
  (change: Change): <E, R>(segment: SegmentChange<E, R>) => Effect.Effect<Array<Input>, E | S.SchemaError, R>
  <E, R>(segment: SegmentChange<E, R>, change: Change): Effect.Effect<Array<Input>, E | S.SchemaError, R>
} = Function.dual(2, <E, R>(segment: SegmentChange<E, R>, change: Change) =>
  Effect.suspend(() => segment(change)).pipe(
    Effect.flatMap(S.decodeUnknownEffect(S.Array(Segment))),
    Effect.flatMap(Effect.forEach((segment) => fromSegment(change, segment), { concurrency: 1 })),
    Effect.map(Array.sort(segmentOrder))
  )
)

/** The one input of a change that no segmenter divides: its whole after source, or the whole before source of a deletion. */
export const whole = (change: Change): Input =>
  change.after === undefined
    ? Input.cases.Before.make({
        change: { before: change.before! },
        segment: Segment.cases.Before.make({ range: { start: 0, end: change.before!.text.length } })
      })
    : Input.cases.After.make({
        change: { ...change, after: change.after },
        segment: Segment.cases.After.make({ range: { start: 0, end: change.after.text.length } })
      })
