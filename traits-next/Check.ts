import { Array, Cause, Deferred, Effect, Exit, Option, Order, pipe, Predicate, Schema as S, Types } from "effect"

import { EnrichmentRegistry } from "./Enrichment/EnrichmentRegistry.ts"
import * as Enrichment from "./Enrichment/index.ts"
import * as Report from "./Report/index.ts"
import {
  type Change,
  fromSegment,
  Input,
  type ModuleSpecifier,
  RecoveryInstruction,
  Segment,
  toSegment
} from "./schema/index.ts"
import * as Segmenter from "./Segmenter/index.ts"
import { SegmenterRegistry } from "./Segmenter/SegmenterRegistry.ts"
import type { Trait } from "./Trait.ts"
import * as TraitAssertion from "./TraitAssertion.ts"

/** Caller-ordered traits and text changes; traits must contain canonical extension references. */
export interface CheckRequest {
  /** Static trait definitions in report order, with canonical extension references. */
  readonly traits: ReadonlyArray<Trait>
  /** Text snapshots in caller order; report change indices refer to this array. */
  readonly changes: ReadonlyArray<Change>
  /** Cooperative cancellation returns an interrupted partial report; directly interrupting the calling fiber retains normal Effect interruption semantics. */
  readonly signal?: AbortSignal
}

type Observed<A> = Types.Mutable<{
  readonly exit?: Exit.Exit<A, unknown>
  readonly diagnostic?: Report.Diagnostic | undefined
}>
type SegmenterSetup = Observed<Effect.Success<ReturnType<SegmenterRegistry["Service"]>>>
type EnrichmentSetup = Observed<Effect.Success<ReturnType<EnrichmentRegistry["Service"]>>>
type EnrichmentState = Types.Mutable<{
  readonly module: ModuleSpecifier
  readonly text?: string
  readonly diagnostic?: Report.Diagnostic
}>
type InputState = Types.Mutable<{
  readonly change: number
  readonly input: Input
  readonly status: Report.InputStatus
  readonly enrichments: Array<EnrichmentState>
  readonly assessment?: Report.Assessment
  readonly diagnostic?: Report.Diagnostic
}>

const capture = <A, E, R>(operation: Effect.Effect<A, E, R>, record: (exit: Exit.Exit<A, E>) => void) =>
  operation.pipe(
    Effect.onExit((exit) => Effect.sync(() => record(exit))),
    Effect.exit
  )

const failure = (cause: Cause.Cause<unknown>, origin: Report.DiagnosticOrigin) => {
  if (Cause.hasInterruptsOnly(cause)) {
    return undefined
  }
  const generic = Report.Diagnostic.cases.Error.make({
    origin,
    error: Report.DiagnosticOrigin.match(origin, {
      SegmenterSetup: () => "Segmenter initialization failed.",
      SegmenterExecution: () => "Segmentation failed or returned invalid inputs.",
      EnrichmentSetup: () => "Enrichment initialization failed.",
      EnrichmentExecution: () => "Enrichment execution failed.",
      AssessmentExecution: () => "Assertion assessment failed or returned invalid probabilities."
    })
  })
  // Only recognized, stage-specific recovery signals contribute text. Never format arbitrary failures or defects.
  try {
    const error = Option.getOrUndefined(Cause.findErrorOption(cause))
    const recognized = Report.DiagnosticOrigin.match(origin, {
      SegmenterSetup: () => S.is(Segmenter.SegmenterSetupError)(error),
      SegmenterExecution: () => S.is(Segmenter.SegmenterError)(error),
      EnrichmentSetup: () => S.is(Enrichment.EnrichmentSetupError)(error),
      EnrichmentExecution: () => S.is(Enrichment.EnrichmentError)(error),
      AssessmentExecution: () => false
    })
    if (recognized && Predicate.hasProperty(error, "instruction") && S.is(RecoveryInstruction)(error.instruction)) {
      return {
        diagnostic: Report.Diagnostic.cases.Instruction.make({ origin, instruction: error.instruction }),
        recovery: S.is(Enrichment.EnrichmentError)(error) ? error.reason._tag : undefined
      }
    }
  } catch {
    // Malformed recovery objects must not prevent normalization of the original failure.
  }
  return { diagnostic: generic, recovery: undefined }
}

/** Evaluates changes against traits. Keep the segmenter and enrichment registry layers alive across calls to share setup; execution results are never cached across checks. */
export const check = Effect.fn("Check.check")(function* (request: CheckRequest) {
  const segmenterRegistry = yield* SegmenterRegistry
  const enrichmentRegistry = yield* EnrichmentRegistry
  const segmenters = new Map<ModuleSpecifier, SegmenterSetup>()
  const enrichments = new Map<ModuleSpecifier, EnrichmentSetup>()
  const segmented = new Map<ModuleSpecifier, Array<Observed<ReadonlyArray<Segment>>>>()
  const traits: Array<
    Types.Mutable<{ readonly trait: Trait; readonly inputs: Array<InputState>; readonly cancelled: boolean }>
  > = Array.map(request.traits, (trait) => ({ trait, inputs: [], cancelled: false }))
  let interrupted = false
  for (const trait of request.traits) {
    if (trait.segment !== undefined && !segmenters.has(trait.segment)) {
      segmenters.set(trait.segment, {})
      segmented.set(
        trait.segment,
        Array.map(request.changes, () => ({}))
      )
    }
    for (const module of trait.enrichments ?? []) {
      if (!enrichments.has(module)) {
        enrichments.set(module, {})
      }
    }
  }
  const work = Effect.gen(function* () {
    yield* Effect.all(
      [
        Effect.forEach(
          segmenters,
          Effect.fnUntraced(function* (entry) {
            const [module, state] = entry
            yield* capture(segmenterRegistry(module), (exit) => {
              state.exit = exit
              if (Exit.isFailure(exit)) {
                state.diagnostic = failure(
                  exit.cause,
                  Report.DiagnosticOrigin.cases.SegmenterSetup.make({ module })
                )?.diagnostic
                interrupted ||= Cause.hasInterruptsOnly(exit.cause)
              }
            })
          }),
          { concurrency: "unbounded", discard: true }
        ),
        Effect.forEach(
          enrichments,
          Effect.fnUntraced(function* (entry) {
            const [module, state] = entry
            yield* capture(enrichmentRegistry(module), (exit) => {
              state.exit = exit
              if (Exit.isFailure(exit)) {
                state.diagnostic = failure(
                  exit.cause,
                  Report.DiagnosticOrigin.cases.EnrichmentSetup.make({ module })
                )?.diagnostic
                interrupted ||= Cause.hasInterruptsOnly(exit.cause)
              }
            })
          }),
          { concurrency: "unbounded", discard: true }
        )
      ],
      { concurrency: "unbounded" }
    )

    yield* Effect.forEach(
      segmenters,
      Effect.fnUntraced(function* (entry) {
        const [module, setup] = entry
        if (setup.exit === undefined || Exit.isFailure(setup.exit)) {
          return
        }
        const execute = setup.exit.value
        yield* Effect.forEach(
          request.changes,
          Effect.fnUntraced(function* (change, index) {
            const state = segmented.get(module)![index]!
            const operation = Effect.suspend(() => execute(change)).pipe(
              Effect.flatMap(S.decodeUnknownEffect(S.Array(Segment))),
              Effect.flatMap((segments) =>
                pipe(
                  Array.map(segments, (segment) => ({ ...segment, change })),
                  S.decodeUnknownEffect(S.Array(Input))
                )
              ),
              Effect.map((inputs) =>
                Array.sort(
                  Array.map(inputs, toSegment),
                  Order.make<Segment>(
                    (left, right) =>
                      Order.Number(left._tag === "Before" ? 0 : 1, right._tag === "Before" ? 0 : 1) ||
                      Order.Number(left.range.start, right.range.start) ||
                      Order.Number(left.range.end, right.range.end)
                  )
                )
              )
            )
            yield* capture(operation, (exit) => {
              state.exit = exit
              if (Exit.isFailure(exit)) {
                state.diagnostic = failure(
                  exit.cause,
                  Report.DiagnosticOrigin.cases.SegmenterExecution.make({ module, change: index })
                )?.diagnostic
                interrupted ||= Cause.hasInterruptsOnly(exit.cause)
              }
            })
          }),
          { concurrency: "unbounded", discard: true }
        )
      }),
      { concurrency: "unbounded", discard: true }
    )

    for (const state of traits) {
      for (const [index, change] of request.changes.entries()) {
        let segments: ReadonlyArray<Segment>
        if (state.trait.segment === undefined) {
          const source = (change.after ?? change.before)!
          const range = { start: 0, end: source.text.length }
          segments = [
            change.after === undefined ? Segment.cases.Before.make({ range }) : Segment.cases.After.make({ range })
          ]
        } else {
          const exit = segmented.get(state.trait.segment)![index]!.exit
          if (exit === undefined || Exit.isFailure(exit)) {
            continue
          }
          segments = exit.value
        }
        for (const segment of segments) {
          const input = yield* fromSegment(change, segment)
          state.inputs.push({
            change: index,
            input,
            status: "Cancelled",
            enrichments: Array.map(state.trait.enrichments ?? [], (module) => ({ module }))
          })
        }
      }
    }

    yield* Effect.forEach(
      traits,
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
                  const setup = enrichments.get(enrichmentState.module)!.exit
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
                        const observed = failure(
                          exit.cause,
                          Report.DiagnosticOrigin.cases.EnrichmentExecution.make({
                            module: enrichmentState.module,
                            trait: traitIndex,
                            input: inputIndex
                          })
                        )
                        if (observed === undefined) {
                          interrupted ||= !traitState.cancelled && inputState.status !== "Failed"
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
              if (inputState.status === "Failed" || traitState.cancelled || interrupted) {
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
                (exit) => {
                  if (Exit.isSuccess(exit)) {
                    inputState.assessment = exit.value
                    inputState.status = "Completed"
                  } else {
                    const observed = failure(
                      exit.cause,
                      Report.DiagnosticOrigin.cases.AssessmentExecution.make({ trait: traitIndex, input: inputIndex })
                    )
                    if (observed !== undefined) {
                      inputState.diagnostic = observed.diagnostic
                      inputState.status = "Failed"
                    } else {
                      interrupted ||= !traitState.cancelled
                    }
                  }
                }
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
  })

  return yield* Effect.uninterruptibleMask((restore) =>
    Effect.gen(function* () {
      const stopping = request.signal
      const cancellation =
        stopping === undefined
          ? Effect.never
          : Effect.callback<void>((resume) => {
              const abort = () => resume(Effect.void)
              if (stopping.aborted) {
                abort()
              } else {
                stopping.addEventListener("abort", abort, { once: true })
              }
              return Effect.sync(() => stopping.removeEventListener("abort", abort))
            })
      const exit = yield* restore(
        work.pipe(Effect.raceFirst(cancellation.pipe(Effect.andThen(Effect.interrupt))))
      ).pipe(Effect.exit)
      if (Exit.isFailure(exit)) {
        if (!Cause.hasInterrupts(exit.cause)) {
          return yield* Effect.failCause(exit.cause)
        }
        interrupted = true
      }
      return Report.Report.make({
        changes: Array.map(request.changes, (change) =>
          change.after === undefined
            ? { before: change.before!.path }
            : { after: change.after.path, ...(change.before === undefined ? {} : { before: change.before.path }) }
        ),
        interrupted,
        diagnostics: Array.filter(
          [
            ...Array.map(Array.fromIterable(segmenters.values()), (state) => state.diagnostic),
            ...Array.map(Array.fromIterable(enrichments.values()), (state) => state.diagnostic),
            ...Array.flatMap(Array.fromIterable(segmented.values()), (states) =>
              Array.map(states, (state) => state.diagnostic)
            ),
            ...Array.flatMap(traits, (state) =>
              Array.flatMap(state.inputs, (input) => [
                ...Array.map(input.enrichments, (enrichment) => enrichment.diagnostic),
                input.diagnostic
              ])
            )
          ],
          Predicate.isNotUndefined
        ),
        traits: Array.map(traits, (state) => ({
          trait: state.trait,
          inputs: Array.map(state.inputs, (entry) => ({
            change: entry.change,
            segment: toSegment(entry.input),
            status: entry.status,
            enrichments: Array.flatMap(entry.enrichments, (enrichment) =>
              enrichment.text === undefined ? [] : [{ module: enrichment.module, text: enrichment.text }]
            ),
            ...(entry.assessment === undefined ? {} : { assessment: entry.assessment })
          }))
        }))
      })
    })
  )
})
