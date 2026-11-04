import { Array, Effect, Result } from "effect"

import * as Report from "../Report/index.ts"
import { fromSegment, Segment } from "../schema/index.ts"
import type { CheckInput } from "./CheckInput.ts"
import * as Execution from "./Execution.ts"
import * as Preparation from "./Preparation.ts"

export type { CheckInput } from "./CheckInput.ts"
export type { CheckTarget } from "./CheckTarget.ts"

/** Evaluates changes against traits. Keep registry layers alive across calls to share setup; execution results belong to one check. */
export const check = Effect.fn("Check.check")(function* (input: CheckInput) {
  const preparation = yield* Preparation.make(input)
  const traits = yield* Effect.forEach(
    preparation.traits,
    Effect.fnUntraced(function* (prepared) {
      const { trait } = prepared
      const targetsByChange = yield* Effect.forEach(
        input.changes,
        Effect.fnUntraced(function* (change, index) {
          if (trait.segment === undefined) {
            return yield* fromSegment(
              change,
              change.after === undefined
                ? Segment.cases.Before.make({ range: { start: 0, end: change.before!.text.length } })
                : Segment.cases.After.make({ range: { start: 0, end: change.after.text.length } })
            ).pipe(Effect.map((input) => [{ change: index, input }]))
          }
          const result = preparation.segmentations.get(trait.segment)?.[index]
          if (result === undefined || Result.isFailure(result)) {
            return []
          }
          return yield* Effect.forEach(result.success, (segment) =>
            fromSegment(change, segment).pipe(Effect.map((input) => ({ change: index, input })))
          )
        })
      )
      return { ...prepared, targets: Array.flatten(targetsByChange) }
    })
  )
  const evaluation = yield* Execution.evaluate({ traits })
  return Report.Report.make({
    changes: Array.map(input.changes, (change) =>
      change.after === undefined
        ? { before: change.before!.path }
        : { after: change.after.path, ...(change.before === undefined ? {} : { before: change.before.path }) }
    ),
    interrupted: false,
    traits: evaluation.traits,
    diagnostics: [
      ...preparation.setupDiagnostics,
      ...Array.flatMap(Array.fromIterable(preparation.segmentations.values()), Array.getFailures),
      ...evaluation.diagnostics
    ]
  })
})
