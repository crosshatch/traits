import { Array, Effect, flow, Function, Order, Schema as S } from "effect"

import { type Change, Input, Segment, toSegment } from "../schema/index.ts"

const segmentOrder = Order.make<Segment>(
  (left, right) =>
    Order.Number(Segment.guards.Before(left) ? 0 : 1, Segment.guards.Before(right) ? 0 : 1) ||
    Order.Number(left.range.start, right.range.start) ||
    Order.Number(left.range.end, right.range.end)
)

/** Rejects the whole result if any segment is invalid for its source, then orders targets deterministically. */
export const execute: {
  (
    change: Change
  ): <E, R>(
    segment: (change: Change) => Effect.Effect<ReadonlyArray<Segment>, E, R>
  ) => Effect.Effect<Array<Segment>, E | S.SchemaError, R>
  <E, R>(
    segment: (change: Change) => Effect.Effect<ReadonlyArray<Segment>, E, R>,
    change: Change
  ): Effect.Effect<Array<Segment>, E | S.SchemaError, R>
} = Function.dual(2, <E, R>(segment: (change: Change) => Effect.Effect<ReadonlyArray<Segment>, E, R>, change: Change) =>
  Effect.suspend(() => segment(change)).pipe(
    Effect.flatMap(S.decodeUnknownEffect(S.Array(Segment))),
    Effect.flatMap(
      flow(
        Array.map((segment: Segment) => ({ ...segment, change })),
        S.decodeUnknownEffect(S.Array(Input))
      )
    ),
    Effect.map(flow(Array.map(toSegment), Array.sort(segmentOrder)))
  )
)
