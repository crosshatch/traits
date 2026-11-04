import { Deferred, Effect, Result, Schema as S } from "effect"

import * as Enrichment from "../Enrichment/index.ts"
import * as Report from "../Report/index.ts"
import type { ModuleSpecifier } from "../schema/index.ts"
import * as TraitAssertion from "../TraitAssertion.ts"
import * as State from "./CheckState.ts"
import type { Preparation } from "./Preparation.ts"

/** Returns ordered results; Deferreds coordinate recovery only, never store report state. */
export const evaluate = (options: {
  readonly traits: ReadonlyArray<State.TraitWork>
  readonly enrichments: Preparation["enrichments"]
}) =>
  Effect.forEach(
    options.traits,
    Effect.fnUntraced(function* (work, traitIndex) {
      const cancelTrait = yield* Deferred.make<void>()
      const { trait } = work
      const evaluateInput = Effect.fnUntraced(function* (input: State.InputWork, inputIndex: number) {
        const cancelInput = yield* Deferred.make<void>()
        const cancelled = State.EnrichmentOutcome.Cancelled()
        const cancellation = Effect.raceFirst(Deferred.await(cancelInput), Deferred.await(cancelTrait))
        const runEnrichment = Effect.fnUntraced(function* (
          module: ModuleSpecifier
        ): Effect.fn.Return<State.EnrichmentResult> {
          const setup = options.enrichments.get(module)
          if (setup === undefined || Result.isFailure(setup)) {
            return { module, outcome: cancelled }
          }
          if ((yield* Deferred.isDone(cancelInput)) || (yield* Deferred.isDone(cancelTrait))) {
            return { module, outcome: cancelled }
          }
          const origin = Report.DiagnosticOrigin.cases.EnrichmentExecution.make({
            module,
            trait: traitIndex,
            input: inputIndex
          })
          const fallback = State.EnrichmentOutcome.Failed({
            recovery: "Enrichment",
            diagnostic: Report.Diagnostic.cases.Error.make({ origin, error: "Enrichment execution failed." })
          })
          // Race only the operation. Recovery is handled after it settles, so its own cancellation
          // signal cannot replace the failing enrichment's diagnostic with a Cancelled result.
          const outcome = yield* setup.success.pipe(
            Effect.provideService(Enrichment.EnrichmentContext, { trait, input: input.input }),
            Effect.flatMap(S.decodeUnknownEffect(S.String)),
            Effect.map((text) => State.EnrichmentOutcome.Completed({ text })),
            Effect.catchTags({
              EnrichmentError: (error) =>
                Effect.succeed(
                  State.EnrichmentOutcome.Failed({
                    recovery: error.reason._tag,
                    diagnostic: Report.Diagnostic.cases.Instruction.make({ origin, instruction: error.instruction })
                  })
                ),
              SchemaError: () => Effect.succeed(fallback)
            }),
            Effect.catchDefect(() => Effect.succeed(fallback)),
            Effect.raceFirst(cancellation.pipe(Effect.as(cancelled)))
          )
          if (State.EnrichmentOutcome.$is("Failed")(outcome) && outcome.recovery !== "Enrichment") {
            if (outcome.recovery === "Trait") {
              yield* Deferred.succeed(cancelTrait, undefined)
            }
            yield* Deferred.succeed(cancelInput, undefined)
          }
          return { module, outcome }
        })
        const enrichments = yield* Effect.forEach(trait.enrichments ?? [], runEnrichment, { concurrency: "unbounded" })
        if (yield* Deferred.isDone(cancelInput)) {
          return { ...input, enrichments, status: "Failed" } satisfies State.InputResult
        }
        if (yield* Deferred.isDone(cancelTrait)) {
          return { ...input, enrichments, status: "Cancelled" } satisfies State.InputResult
        }
        if (trait.assertion === undefined) {
          return { ...input, enrichments, status: "Completed" } satisfies State.InputResult
        }
        const origin = Report.DiagnosticOrigin.cases.AssessmentExecution.make({ trait: traitIndex, input: inputIndex })
        const diagnostic = Report.Diagnostic.cases.Error.make({
          origin,
          error: "Assertion assessment failed or returned invalid probabilities."
        })
        return yield* TraitAssertion.evaluate(
          {
            assertion: {
              assertion: trait.assertion,
              context: trait,
              enrichments: State.successfulEnrichments(enrichments)
            }
          },
          input.input
        ).pipe(
          Effect.flatMap((response) => Effect.fromResult(response.outcomes.assertion)),
          Effect.map((answer): State.InputResult => ({
            ...input,
            enrichments,
            assessment: answer.probabilities,
            status: "Completed"
          })),
          Effect.orElseSucceed((): State.InputResult => ({ ...input, enrichments, diagnostic, status: "Failed" })),
          Effect.catchDefect(() =>
            Effect.succeed<State.InputResult>({ ...input, enrichments, diagnostic, status: "Failed" })
          ),
          Effect.raceFirst(
            Deferred.await(cancelTrait).pipe(
              Effect.as<State.InputResult>({ ...input, enrichments, status: "Cancelled" })
            )
          )
        )
      })
      const inputs = yield* Effect.forEach(work.inputs, evaluateInput, { concurrency: "unbounded" })
      return { trait, inputs } satisfies State.TraitResult
    }),
    { concurrency: "unbounded" }
  )
