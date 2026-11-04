import { Array, Deferred, Effect, Exit, Schema as S } from "effect"

import * as Enrichment from "../Enrichment/index.ts"
import * as Report from "../Report/index.ts"
import * as TraitAssertion from "../TraitAssertion.ts"
import { failure } from "./Failure.ts"
import { capture } from "./Observation.ts"
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
                yield* setup.value.pipe(
                  Effect.provideService(Enrichment.EnrichmentContext, {
                    trait: traitState.trait,
                    input: inputState.input
                  }),
                  Effect.flatMap(S.decodeUnknownEffect(S.String)),
                  Effect.onExit(
                    Effect.fnUntraced(function* (exit) {
                      if (Exit.isSuccess(exit)) {
                        enrichmentState.text = exit.value
                        return
                      }
                      const observed = yield* failure({
                        cause: exit.cause,
                        origin: Report.DiagnosticOrigin.cases.EnrichmentExecution.make({
                          module: enrichmentState.module,
                          trait: traitIndex,
                          input: inputIndex
                        })
                      })
                      if (observed === undefined) {
                        state.interrupted ||= !traitState.cancelled && inputState.status !== "Failed"
                        return
                      }
                      enrichmentState.diagnostic = observed.diagnostic
                      if (observed.recovery === "Input" || observed.recovery === "Trait") {
                        inputState.status = "Failed"
                        yield* Deferred.succeed(cancelInput, undefined)
                        if (observed.recovery === "Trait") {
                          traitState.cancelled = true
                          yield* Deferred.succeed(cancelTrait, undefined)
                        }
                      }
                    })
                  ),
                  Effect.exit
                )
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
            yield* capture(
              TraitAssertion.evaluate(
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
                Effect.map((answer) => answer.probabilities)
              ),
              Effect.fnUntraced(function* (exit) {
                if (Exit.isSuccess(exit)) {
                  inputState.assessment = exit.value
                  inputState.status = "Completed"
                } else {
                  const observed = yield* failure({
                    cause: exit.cause,
                    origin: Report.DiagnosticOrigin.cases.AssessmentExecution.make({
                      trait: traitIndex,
                      input: inputIndex
                    })
                  })
                  if (observed !== undefined) {
                    inputState.diagnostic = observed.diagnostic
                    inputState.status = "Failed"
                  } else {
                    state.interrupted ||= !traitState.cancelled
                  }
                }
              })
            )
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
