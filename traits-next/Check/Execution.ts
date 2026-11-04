import { Array, Deferred, Effect, Exit, Option, pipe, Result, Schema as S } from "effect"

import * as Enrichment from "../Enrichment/index.ts"
import * as Report from "../Report/index.ts"
import { type ModuleSpecifier, toSegment } from "../schema/index.ts"
import type { Trait } from "../Trait.ts"
import * as TraitAssertion from "../TraitAssertion.ts"
import type { CheckTarget } from "./Check.ts"
import type { Preparation } from "./Preparation.ts"

/** Returns source-free report entries and diagnostics; Deferreds only coordinate recovery. */
export const evaluate = Effect.fnUntraced(function* (options: {
  readonly traits: ReadonlyArray<{ readonly trait: Trait; readonly inputs: ReadonlyArray<CheckTarget> }>
  readonly enrichmentSetups: Preparation["enrichmentSetups"]
}) {
  const traits = yield* Effect.forEach(
    options.traits,
    Effect.fnUntraced(function* (targets, traitIndex) {
      const traitStopped = yield* Deferred.make<void>()
      const { trait } = targets
      const evaluateInput = Effect.fnUntraced(function* (target: CheckTarget, inputIndex: number) {
        const inputStopped = yield* Deferred.make<void>()
        const runEnrichment = Effect.fnUntraced(function* (
          module: ModuleSpecifier
        ): Effect.fn.Return<Exit.Exit<Report.EnrichmentReport, Report.Diagnostic>> {
          const setup = options.enrichmentSetups.get(module)
          if (setup === undefined || Result.isFailure(setup)) {
            return Exit.interrupt()
          }
          if ((yield* Deferred.isDone(inputStopped)) || (yield* Deferred.isDone(traitStopped))) {
            return Exit.interrupt()
          }
          const origin = Report.DiagnosticOrigin.cases.EnrichmentExecution.make({
            module,
            trait: traitIndex,
            input: inputIndex
          })
          const fallback = Report.Diagnostic.cases.Error.make({ origin, error: "Enrichment execution failed." })
          // Settle the operation before signalling recovery, so its own cancellation cannot erase its failure.
          const exit = yield* setup.success.pipe(
            Effect.provideService(Enrichment.EnrichmentContext, { trait, input: target.input }),
            Effect.flatMap(S.decodeUnknownEffect(S.String)),
            Effect.map((text) => Report.EnrichmentReport.make({ module, text })),
            Effect.catchTags({ SchemaError: () => Effect.fail(fallback) }),
            Effect.catchDefect(() => Effect.fail(fallback)),
            Effect.exit,
            (operation) =>
              Effect.raceAllFirst([
                operation,
                Deferred.await(inputStopped).pipe(Effect.as(Exit.interrupt())),
                Deferred.await(traitStopped).pipe(Effect.as(Exit.interrupt()))
              ])
          )
          if (Exit.isSuccess(exit)) {
            return Exit.succeed(exit.value)
          }
          const error = Option.getOrUndefined(Exit.findErrorOption(exit))
          if (error === undefined) {
            return Exit.interrupt()
          }
          if (error._tag !== "EnrichmentError") {
            return Exit.fail(error)
          }
          if (!Enrichment.EnrichmentErrorReason.guards.Enrichment(error.reason)) {
            if (Enrichment.EnrichmentErrorReason.guards.Trait(error.reason)) {
              yield* Deferred.succeed(traitStopped, undefined)
            }
            yield* Deferred.succeed(inputStopped, undefined)
          }
          return Exit.fail(Report.Diagnostic.cases.Instruction.make({ origin, instruction: error.instruction }))
        })
        const exits = yield* Effect.forEach(trait.enrichments ?? [], runEnrichment, { concurrency: "unbounded" })
        const enrichments = pipe(exits, Array.map(Exit.getSuccess), Array.getSomes)
        const diagnostics = pipe(exits, Array.map(Exit.findErrorOption), Array.getSomes)
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
        const exit = yield* TraitAssertion.evaluate(
          { assertion: { assertion: trait.assertion, context: trait, enrichments } },
          target.input
        ).pipe(
          Effect.flatMap((response) => Effect.fromResult(response.outcomes.assertion)),
          Effect.mapBoth({ onSuccess: (answer) => answer.probabilities, onFailure: () => diagnostic }),
          Effect.catchDefect(() => Effect.fail(diagnostic)),
          Effect.exit,
          Effect.raceFirst(Deferred.await(traitStopped).pipe(Effect.as(Exit.interrupt())))
        )
        if (Exit.isSuccess(exit)) {
          return {
            report: Report.InputReport.make({ ...input, status: "Completed", assessment: exit.value }),
            diagnostics
          }
        }
        const error = Option.getOrUndefined(Exit.findErrorOption(exit))
        return error !== undefined
          ? {
              report: Report.InputReport.make({ ...input, status: "Failed" }),
              diagnostics: [...diagnostics, error]
            }
          : { report: Report.InputReport.make({ ...input, status: "Cancelled" }), diagnostics }
      })
      const inputs = yield* Effect.forEach(targets.inputs, evaluateInput, { concurrency: "unbounded" })
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
