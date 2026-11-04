import { Array, Effect, Result } from "effect"

import { type Change, fromSegment, Segment } from "../schema/index.ts"
import type { Trait } from "../Trait.ts"
import * as State from "./CheckState.ts"
import * as Execution from "./Execution.ts"
import * as Preparation from "./Preparation.ts"

/** Caller-ordered traits and text changes; traits must contain canonical extension references. */
export interface CheckInput {
  /** Static trait definitions in report order, with canonical extension references. */
  readonly traits: ReadonlyArray<Trait>
  /** Text snapshots in caller order; report change indices refer to this array. */
  readonly changes: ReadonlyArray<Change>
}

/** Evaluates changes against traits. Keep registry layers alive across calls to share setup; execution results belong to one check. */
export const check = Effect.fn("Check.check")(function* (input: CheckInput) {
  const preparation = yield* Preparation.make(input)
  const work = yield* Effect.forEach(
    input.traits,
    Effect.fnUntraced(function* (trait) {
      const inputs = yield* Effect.forEach(
        input.changes,
        Effect.fnUntraced(function* (change, index) {
          let segments: ReadonlyArray<Segment>
          if (trait.segment === undefined) {
            segments = [
              change.after === undefined
                ? Segment.cases.Before.make({ range: { start: 0, end: change.before!.text.length } })
                : Segment.cases.After.make({ range: { start: 0, end: change.after.text.length } })
            ]
          } else {
            const result = preparation.segmented.get(trait.segment)?.[index]
            if (result === undefined || Result.isFailure(result)) {
              return []
            }
            segments = result.success
          }
          return yield* Effect.forEach(segments, (segment) =>
            fromSegment(change, segment).pipe(Effect.map((input) => ({ change: index, input })))
          )
        })
      )
      return { trait, inputs: Array.flatten(inputs) }
    })
  )
  const traits = yield* Execution.evaluate({ traits: work, enrichments: preparation.enrichments })
  return State.toReport({ changes: input.changes, preparation, traits })
})
