import { Array, Cause, Deferred, Effect, Exit, Schema as S } from "effect"

import * as Enrichment from "../Enrichment/index.ts"
import * as Report from "../Report/index.ts"
import * as TraitAssertion from "../TraitAssertion.ts"
import type { State } from "./State.ts"

/** Keeps input/trait recovery races beside the work they cancel and records partial results on exit. */
export const evaluate = (state: State) =>
  Effect.forEach(
    state.traits,
    Effect.fnUntraced(function* (traitState, traitIndex) {
      const cancelTrait = yield* Deferred.make<void>()
      yield* Effect.forEach(
        traitState.inputs,
        Effect.fnUntraced(function* (inputState, inputIndex) {
          const cancelInput = yield* Deferred.make<void>()
          const run = Effect.gen(function* () {
            yield* Effect.forEach(
              inputState.enrichments,
              Effect.fnUntraced(function* (enrichmentState) {
                const setup = state.enrichments.get(enrichmentState.module)!.exit
                if (setup === undefined || Exit.isFailure(setup)) {
                  return
                }
                const origin = Report.DiagnosticOrigin.cases.EnrichmentExecution.make({
                  module: enrichmentState.module,
                  trait: traitIndex,
                  input: inputIndex
                })
                const exit = yield* setup.value.pipe(
                  Effect.provideService(Enrichment.EnrichmentContext, {
                    trait: traitState.trait,
                    input: inputState.input
                  }),
                  Effect.flatMap(S.decodeUnknownEffect(S.String)),
                  Effect.tapErrorTag(
                    "EnrichmentError",
                    Effect.fnUntraced(function* (error) {
                      enrichmentState.diagnostic = Report.Diagnostic.cases.Instruction.make({
                        origin,
                        instruction: error.instruction
                      })
                      if (!Enrichment.EnrichmentErrorReason.guards.Enrichment(error.reason)) {
                        inputState.status = "Failed"
                        yield* Deferred.succeed(cancelInput, undefined)
                        if (Enrichment.EnrichmentErrorReason.guards.Trait(error.reason)) {
                          traitState.cancelled = true
                          yield* Deferred.succeed(cancelTrait, undefined)
                        }
                      }
                    }, Effect.uninterruptible)
                  ),
                  Effect.exit
                )
                if (Exit.isSuccess(exit)) {
                  enrichmentState.text = exit.value
                } else if (Cause.hasInterruptsOnly(exit.cause)) {
                  state.interrupted ||= !traitState.cancelled && inputState.status !== "Failed"
                } else {
                  enrichmentState.diagnostic ??= Report.Diagnostic.cases.Error.make({
                    origin,
                    error: "Enrichment execution failed."
                  })
                }
              }),
              { concurrency: "unbounded", discard: true }
            ).pipe(Effect.raceFirst(Deferred.await(cancelInput).pipe(Effect.andThen(Effect.interrupt))), Effect.exit)
            if (inputState.status === "Failed" || traitState.cancelled || state.interrupted) {
              return
            }
            if (traitState.trait.assertion === undefined) {
              inputState.status = "Completed"
              return
            }
            const contexts = Array.flatMap(inputState.enrichments, (entry) =>
              entry.text === undefined ? [] : [{ module: entry.module, text: entry.text }]
            )
            const exit = yield* TraitAssertion.evaluate(
              {
                assertion: {
                  assertion: traitState.trait.assertion,
                  context: traitState.trait,
                  enrichments: contexts
                }
              },
              inputState.input
            ).pipe(
              Effect.flatMap((response) => Effect.fromResult(response.outcomes.assertion)),
              Effect.map((answer) => answer.probabilities),
              Effect.exit
            )
            if (Exit.isSuccess(exit)) {
              inputState.assessment = exit.value
              inputState.status = "Completed"
            } else {
              if (Cause.hasInterruptsOnly(exit.cause)) {
                state.interrupted ||= !traitState.cancelled
              } else {
                inputState.diagnostic = Report.Diagnostic.cases.Error.make({
                  origin: Report.DiagnosticOrigin.cases.AssessmentExecution.make({
                    trait: traitIndex,
                    input: inputIndex
                  }),
                  error: "Assertion assessment failed or returned invalid probabilities."
                })
                inputState.status = "Failed"
              }
            }
          }).pipe(Effect.raceFirst(Deferred.await(cancelTrait).pipe(Effect.andThen(Effect.interrupt))), Effect.exit)
          if (!traitState.cancelled) {
            yield* run
          }
        }),
        { concurrency: "unbounded", discard: true }
      )
    }),
    { concurrency: "unbounded", discard: true }
  )
