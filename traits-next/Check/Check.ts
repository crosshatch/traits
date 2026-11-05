import { Array, Effect, Result } from "effect"

import * as Report from "../Report/index.ts"
import { Input } from "../util/index.ts"
import type { CheckInput } from "./CheckInput.ts"
import * as Execution from "./Execution.ts"
import * as Preparation from "./Preparation.ts"

export type { CheckInput } from "./CheckInput.ts"
export type { CheckTarget } from "./CheckTarget.ts"

/** Evaluates changes against traits. Keep registry layers alive across calls to share setup; execution results belong to one check. */
export const check = Effect.fn("Check.check")(function* (input: CheckInput) {
  const preparation = yield* Preparation.make(input)
  const wholeInputs = Array.map(input.changes, (change) =>
    change.after === undefined
      ? Input.cases.Before.make({
          change: { before: change.before! },
          range: { start: 0, end: change.before!.text.length }
        })
      : Input.cases.After.make({
          change: { ...change, after: change.after },
          range: { start: 0, end: change.after.text.length }
        })
  )
  const traits = Array.map(preparation.traits, (prepared) => ({
    ...prepared,
    targets: Array.flatMap(wholeInputs, (wholeInput, index) => {
      if (prepared.trait.segment === undefined) {
        return [{ change: index, input: wholeInput }]
      }
      const result = preparation.segmentations.get(prepared.trait.segment)?.[index]
      return result === undefined || Result.isFailure(result)
        ? []
        : Array.map(result.success, (input) => ({ change: index, input }))
    })
  }))
  const evaluation = yield* Execution.evaluate({ traits })
  return Report.Report.make({
    changes: Array.map(input.changes, (change) =>
      change.after === undefined
        ? { before: change.before!.path }
        : { after: change.after.path, ...(change.before === undefined ? {} : { before: change.before.path }) }
    ),
    traits: evaluation.traits,
    diagnostics: [
      ...preparation.setupDiagnostics,
      ...Array.flatMap(Array.fromIterable(preparation.segmentations.values()), Array.getFailures),
      ...evaluation.diagnostics
    ]
  })
})
