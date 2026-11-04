import { Array, Effect, Result } from "effect"

import * as Report from "../Report/index.ts"
import { type Change, fromSegment, type Input, Segment } from "../schema/index.ts"
import type { Trait } from "../Trait.ts"
import * as Execution from "./Execution.ts"
import * as Preparation from "./Preparation.ts"

/** Caller-ordered traits and text changes; traits must contain canonical extension references. */
export interface CheckInput {
  /** Static trait definitions in report order, with canonical extension references. */
  readonly traits: ReadonlyArray<Trait>
  /** Text snapshots in caller order; report change indices refer to this array. */
  readonly changes: ReadonlyArray<Change>
}

/** A selected source input paired with its original change index. */
export interface CheckTarget {
  readonly change: number
  readonly input: Input
}

/** Evaluates changes against traits. Keep registry layers alive across calls to share setup; execution results belong to one check. */
export const check = Effect.fn("Check.check")(function* (input: CheckInput) {
  const preparation = yield* Preparation.make(input)
  const targets = yield* Effect.forEach(
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
            const result = preparation.segmentations.get(trait.segment)?.[index]
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
  const evaluation = yield* Execution.evaluate({ traits: targets, enrichmentSetups: preparation.enrichmentSetups })
  return Report.Report.make({
    changes: Array.map(input.changes, (change) =>
      change.after === undefined
        ? { before: change.before!.path }
        : { after: change.after.path, ...(change.before === undefined ? {} : { before: change.before.path }) }
    ),
    interrupted: false,
    traits: evaluation.traits,
    diagnostics: [
      ...Array.getFailures(preparation.segmenterSetups.values()),
      ...Array.getFailures(preparation.enrichmentSetups.values()),
      ...Array.flatMap(Array.fromIterable(preparation.segmentations.values()), Array.getFailures),
      ...evaluation.diagnostics
    ]
  })
})
