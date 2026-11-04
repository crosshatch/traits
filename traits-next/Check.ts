import { Array, Cause, Effect, Exit } from "effect"

import { awaitAbort } from "./Check/Cancellation.ts"
import * as Execution from "./Check/Execution.ts"
import { failure } from "./Check/Failure.ts"
import { capture } from "./Check/Observation.ts"
import * as State from "./Check/State.ts"
import { EnrichmentRegistry } from "./Enrichment/EnrichmentRegistry.ts"
import * as Report from "./Report/index.ts"
import { type Change, fromSegment, Segment } from "./schema/index.ts"
import * as Segmentation from "./Segmenter/Execution.ts"
import { SegmenterRegistry } from "./Segmenter/SegmenterRegistry.ts"
import type { Trait } from "./Trait.ts"

/** Caller-ordered traits and text changes; traits must contain canonical extension references. */
export interface CheckInput {
  /** Static trait definitions in report order, with canonical extension references. */
  readonly traits: ReadonlyArray<Trait>
  /** Text snapshots in caller order; report change indices refer to this array. */
  readonly changes: ReadonlyArray<Change>
  /** Cooperative cancellation returns an interrupted partial report; directly interrupting the calling fiber retains normal Effect interruption semantics. */
  readonly signal?: AbortSignal | undefined
}

/** Evaluates changes against traits. Keep the segmenter and enrichment registry layers alive across calls to share setup; execution results are never cached across checks. */
export const check = Effect.fn("Check.check")(function* (request: CheckInput) {
  const segmenterRegistry = yield* SegmenterRegistry
  const enrichmentRegistry = yield* EnrichmentRegistry
  const state = State.make(request)
  const { segmenters, enrichments, segmented, traits } = state

  const work = Effect.gen(function* () {
    yield* Effect.all(
      [
        Effect.forEach(
          segmenters,
          Effect.fnUntraced(function* (entry) {
            const [module, setup] = entry
            yield* capture(
              segmenterRegistry(module),
              Effect.fnUntraced(function* (exit) {
                setup.exit = exit
                if (Exit.isFailure(exit)) {
                  const observed = yield* failure({
                    cause: exit.cause,
                    origin: Report.DiagnosticOrigin.cases.SegmenterSetup.make({ module })
                  })
                  setup.diagnostic = observed?.diagnostic
                  state.interrupted ||= Cause.hasInterruptsOnly(exit.cause)
                }
              })
            )
          }),
          { concurrency: "unbounded", discard: true }
        ),
        Effect.forEach(
          enrichments,
          Effect.fnUntraced(function* (entry) {
            const [module, setup] = entry
            yield* capture(
              enrichmentRegistry(module),
              Effect.fnUntraced(function* (exit) {
                setup.exit = exit
                if (Exit.isFailure(exit)) {
                  const observed = yield* failure({
                    cause: exit.cause,
                    origin: Report.DiagnosticOrigin.cases.EnrichmentSetup.make({ module })
                  })
                  setup.diagnostic = observed?.diagnostic
                  state.interrupted ||= Cause.hasInterruptsOnly(exit.cause)
                }
              })
            )
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
            const result = segmented.get(module)![index]!
            yield* capture(
              Segmentation.execute(execute, change),
              Effect.fnUntraced(function* (exit) {
                result.exit = exit
                if (Exit.isFailure(exit)) {
                  const observed = yield* failure({
                    cause: exit.cause,
                    origin: Report.DiagnosticOrigin.cases.SegmenterExecution.make({
                      module,
                      change: index
                    })
                  })
                  result.diagnostic = observed?.diagnostic
                  state.interrupted ||= Cause.hasInterruptsOnly(exit.cause)
                }
              })
            )
          }),
          { concurrency: "unbounded", discard: true }
        )
      }),
      { concurrency: "unbounded", discard: true }
    )

    for (const traitState of traits) {
      for (const [index, change] of request.changes.entries()) {
        let segments: ReadonlyArray<Segment>
        if (traitState.trait.segment === undefined) {
          segments = [
            change.after === undefined
              ? Segment.cases.Before.make({ range: { start: 0, end: change.before!.text.length } })
              : Segment.cases.After.make({ range: { start: 0, end: change.after.text.length } })
          ]
        } else {
          const exit = segmented.get(traitState.trait.segment)![index]!.exit
          if (exit === undefined || Exit.isFailure(exit)) {
            continue
          }
          segments = exit.value
        }
        for (const segment of segments) {
          const input = yield* fromSegment(change, segment)
          traitState.inputs.push({
            change: index,
            input,
            status: "Cancelled",
            enrichments: Array.map(traitState.trait.enrichments ?? [], (module) => ({ module }))
          })
        }
      }
    }

    yield* Execution.evaluate(state)
  })

  return yield* Effect.uninterruptibleMask((restore) =>
    Effect.gen(function* () {
      const exit = yield* restore(
        work.pipe(Effect.raceFirst(awaitAbort(request.signal).pipe(Effect.andThen(Effect.interrupt))))
      ).pipe(Effect.exit)
      if (Exit.isFailure(exit)) {
        if (!Cause.hasInterrupts(exit.cause)) {
          return yield* Effect.failCause(exit.cause)
        }
        state.interrupted = true
      }
      return State.toReport(state)
    })
  )
})
