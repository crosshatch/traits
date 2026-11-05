import { Array, Deferred, Effect, Result } from "effect"

import * as Enrichment from "../Enrichment/index.ts"
import * as Report from "../Report/index.ts"
import * as TraitAssertion from "../TraitAssertion.ts"
import { toSegment } from "../util/index.ts"
import type { CheckTarget } from "./CheckTarget.ts"
import type { Preparation } from "./Preparation.ts"

/** Returns source-free report entries and diagnostics; Deferreds only coordinate recovery. */
export const evaluate = Effect.fnUntraced(function* (options: {
  readonly traits: ReadonlyArray<Preparation["traits"][number] & { readonly targets: ReadonlyArray<CheckTarget> }>
}) {
  const traits = yield* Effect.forEach(
    options.traits,
    Effect.fnUntraced(function* (prepared, traitIndex) {
      const traitStopped = yield* Deferred.make<void>()
      const { trait } = prepared
      const evaluateInput = Effect.fnUntraced(function* (target: CheckTarget, inputIndex: number) {
        const inputStopped = yield* Deferred.make<void>()
        const results = yield* Effect.forEach(
          prepared.enrichments,
          Effect.fnUntraced(function* (enrichment) {
            if ((yield* Deferred.isDone(inputStopped)) || (yield* Deferred.isDone(traitStopped))) {
              return Result.succeed([])
            }
            const { module, execute } = enrichment
            const origin = Report.DiagnosticOrigin.cases.EnrichmentExecution.make({
              module,
              trait: traitIndex,
              input: inputIndex
            })
            const fallback = Report.Diagnostic.cases.Error.make({ origin, error: "Enrichment execution failed." })
            return yield* execute.pipe(
              Effect.provideService(Enrichment.EnrichmentContext, { trait, input: target.input }),
              Effect.map((text) => [Report.EnrichmentReport.make({ module, text })]),
              (operation) =>
                Effect.raceAllFirst([
                  operation,
                  Deferred.await(inputStopped).pipe(Effect.as([])),
                  Deferred.await(traitStopped).pipe(Effect.as([]))
                ]),
              // Handle recovery after the operation race, so its own stop signal cannot erase its diagnostic.
              Effect.catchTags({
                EnrichmentError: Effect.fnUntraced(function* (error) {
                  if (!Enrichment.EnrichmentErrorReason.guards.Enrichment(error.reason)) {
                    if (Enrichment.EnrichmentErrorReason.guards.Trait(error.reason)) {
                      yield* Deferred.succeed(traitStopped, undefined)
                    }
                    yield* Deferred.succeed(inputStopped, undefined)
                  }
                  return yield* Effect.fail(
                    Report.Diagnostic.cases.Instruction.make({ origin, instruction: error.instruction })
                  )
                }),
                SchemaError: () => Effect.fail(fallback)
              }),
              Effect.catchDefect(() => Effect.fail(fallback)),
              Effect.result
            )
          }),
          { concurrency: "unbounded" }
        )
        const enrichments = Array.flatten(Array.getSuccesses(results))
        const diagnostics = Array.getFailures(results)
        const input = { change: target.change, segment: toSegment(target.input), enrichments }
        if (yield* Deferred.isDone(inputStopped)) {
          return { report: Report.InputReport.make({ ...input, status: "Failed" }), diagnostics }
        }
        if (yield* Deferred.isDone(traitStopped)) {
          return { report: Report.InputReport.make({ ...input, status: "Cancelled" }), diagnostics }
        }
        if (trait.assertion === undefined) {
          return { report: Report.InputReport.make({ ...input, status: "Completed" }), diagnostics }
        }
        const origin = Report.DiagnosticOrigin.cases.AssessmentExecution.make({ trait: traitIndex, input: inputIndex })
        const diagnostic = Report.Diagnostic.cases.Error.make({
          origin,
          error: "Assertion assessment failed or returned invalid probabilities."
        })
        return yield* TraitAssertion.evaluate(
          { assertion: { assertion: trait.assertion, context: trait, enrichments } },
          target.input
        ).pipe(
          Effect.flatMap((response) => Effect.fromResult(response.outcomes.assertion)),
          Effect.catchDefect(() => Effect.fail(diagnostic)),
          Effect.match({
            onSuccess: (answer) => ({
              report: Report.InputReport.make({ ...input, status: "Completed", assessment: answer.probabilities }),
              diagnostics
            }),
            onFailure: () => ({
              report: Report.InputReport.make({ ...input, status: "Failed" }),
              diagnostics: [...diagnostics, diagnostic]
            })
          }),
          Effect.raceFirst(
            Deferred.await(traitStopped).pipe(
              Effect.as({
                report: Report.InputReport.make({ ...input, status: "Cancelled" }),
                diagnostics
              })
            )
          )
        )
      })
      const inputs = yield* Effect.forEach(prepared.targets, evaluateInput, { concurrency: "unbounded" })
      return {
        report: Report.TraitReport.make({ trait, inputs: Array.map(inputs, (input) => input.report) }),
        diagnostics: Array.flatMap(inputs, (input) => input.diagnostics)
      }
    }),
    { concurrency: "unbounded" }
  )
  return {
    traits: Array.map(traits, (trait) => trait.report),
    diagnostics: Array.flatMap(traits, (trait) => trait.diagnostics)
  }
})
