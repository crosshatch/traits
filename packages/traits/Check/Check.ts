import { Array, Effect, pipe, Schema as S } from "effect"

import PackageJson from "../package.json" with { type: "json" }
import * as ChangeIdentity from "../Report/ChangeIdentity.ts"
import { Report } from "../Report/Report.ts"
import * as Run from "../Report/Run.ts"
import { CurrentSettings } from "../Settings.ts"
import { CheckInput } from "./CheckInput.ts"
import * as Evaluation from "./Evaluation.ts"
import * as Preparation from "./Preparation.ts"

export * from "./CheckInput.ts"

/** Evaluates changes against traits. Keep registry layers alive across calls to share setup; execution results belong to one check. Fails for an invalid request, before any extension or model work, or with the decision model's AiError when its provider rejects the account (credentials, permissions, or quota), since no further decision could succeed; other decision failures are recorded on their inputs. */
export const check = Effect.fn("Check.check")(function* (request: CheckInput) {
  const input = yield* pipe(request, S.decodeEffect(CheckInput))
  const {
    check: { digestConcurrency, ruleOut }
  } = yield* CurrentSettings
  const preparation = yield* Preparation.make(input)
  const { traits, responses } = yield* Evaluation.evaluate(input, preparation)
  const changes = yield* Effect.forEach(
    input.changes,
    ChangeIdentity.fromChange,
    // Each digest holds an encoded copy of its source text.
    { concurrency: digestConcurrency }
  )
  return Report.make({
    version: PackageJson.version,
    run: Run.fromResponses(responses, ruleOut),
    changes,
    traits,
    diagnostics: [
      ...preparation.setupDiagnostics,
      ...pipe(preparation.segmentations.values(), Array.fromIterable, Array.flatMap(Array.getFailures))
    ]
  })
})
