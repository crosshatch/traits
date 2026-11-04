import { Array, Effect, Result } from "effect"

import { EnrichmentRegistry } from "../Enrichment/EnrichmentRegistry.ts"
import * as Report from "../Report/index.ts"
import type { Change, ModuleSpecifier, Segment } from "../schema/index.ts"
import * as Segmentation from "../Segmenter/Execution.ts"
import { SegmenterRegistry } from "../Segmenter/SegmenterRegistry.ts"
import type { Trait } from "../Trait.ts"

/** Completed setup and segmentation shared by all traits in one check. */
export interface Preparation {
  readonly segmenters: ReadonlyMap<
    ModuleSpecifier,
    Result.Result<Effect.Success<ReturnType<SegmenterRegistry["Service"]>>, Report.Diagnostic>
  >
  readonly enrichments: ReadonlyMap<
    ModuleSpecifier,
    Result.Result<Effect.Success<ReturnType<EnrichmentRegistry["Service"]>>, Report.Diagnostic>
  >
  readonly segmented: ReadonlyMap<
    ModuleSpecifier,
    ReadonlyArray<Result.Result<ReadonlyArray<Segment>, Report.Diagnostic>>
  >
}

/** Collects immutable results; registry layers, not preparation, own setup caching. */
export const make = Effect.fnUntraced(function* (request: {
  readonly traits: ReadonlyArray<Trait>
  readonly changes: ReadonlyArray<Change>
}): Effect.fn.Return<Preparation, never, SegmenterRegistry | EnrichmentRegistry> {
  const segmenterRegistry = yield* SegmenterRegistry
  const enrichmentRegistry = yield* EnrichmentRegistry
  const modules = {
    segmenters: Array.dedupe(
      Array.flatMap(request.traits, (trait) => (trait.segment === undefined ? [] : [trait.segment]))
    ),
    enrichments: Array.dedupe(Array.flatMap(request.traits, (trait) => trait.enrichments ?? []))
  }
  const setups = yield* Effect.all(
    {
      segmenters: Effect.forEach(
        modules.segmenters,
        Effect.fnUntraced(function* (module) {
          const origin = Report.DiagnosticOrigin.cases.SegmenterSetup.make({ module })
          const fallback = Report.Diagnostic.cases.Error.make({ origin, error: "Segmenter initialization failed." })
          const result = yield* segmenterRegistry(module).pipe(
            Effect.catchTags({
              SegmenterSetupError: (error) =>
                Effect.fail(Report.Diagnostic.cases.Instruction.make({ origin, instruction: error.instruction })),
              SchemaError: () => Effect.fail(fallback)
            }),
            Effect.catchDefect(() => Effect.fail(fallback)),
            Effect.result
          )
          return [module, result] as const
        }),
        { concurrency: "unbounded" }
      ),
      enrichments: Effect.forEach(
        modules.enrichments,
        Effect.fnUntraced(function* (module) {
          const origin = Report.DiagnosticOrigin.cases.EnrichmentSetup.make({ module })
          const fallback = Report.Diagnostic.cases.Error.make({ origin, error: "Enrichment initialization failed." })
          const result = yield* enrichmentRegistry(module).pipe(
            Effect.catchTags({
              EnrichmentSetupError: (error) =>
                Effect.fail(Report.Diagnostic.cases.Instruction.make({ origin, instruction: error.instruction })),
              SchemaError: () => Effect.fail(fallback)
            }),
            Effect.catchDefect(() => Effect.fail(fallback)),
            Effect.result
          )
          return [module, result] as const
        }),
        { concurrency: "unbounded" }
      )
    },
    { concurrency: "unbounded" }
  )
  const segmented = yield* Effect.forEach(
    Array.flatMap(setups.segmenters, (entry) =>
      Result.isSuccess(entry[1]) ? [[entry[0], entry[1].success] as const] : []
    ),
    Effect.fnUntraced(function* (entry) {
      const [module, execute] = entry
      const results = yield* Effect.forEach(
        request.changes,
        Effect.fnUntraced(function* (change, index) {
          const origin = Report.DiagnosticOrigin.cases.SegmenterExecution.make({ module, change: index })
          const fallback = Report.Diagnostic.cases.Error.make({
            origin,
            error: "Segmentation failed or returned invalid inputs."
          })
          return yield* Segmentation.execute(execute, change).pipe(
            Effect.catchTags({
              SegmenterError: (error) =>
                Effect.fail(Report.Diagnostic.cases.Instruction.make({ origin, instruction: error.instruction })),
              SchemaError: () => Effect.fail(fallback)
            }),
            Effect.catchDefect(() => Effect.fail(fallback)),
            Effect.result
          )
        }),
        { concurrency: "unbounded" }
      )
      return [module, results] as const
    }),
    { concurrency: "unbounded" }
  )
  return {
    segmenters: new Map(setups.segmenters),
    enrichments: new Map(setups.enrichments),
    segmented: new Map(segmented)
  }
})
