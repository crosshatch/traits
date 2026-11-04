import { Array, Effect, pipe, Result } from "effect"

import { EnrichmentRegistry } from "../Enrichment/EnrichmentRegistry.ts"
import * as Report from "../Report/index.ts"
import type { ModuleSpecifier, Segment } from "../schema/index.ts"
import * as Segmentation from "../Segmenter/Execution.ts"
import { SegmenterRegistry } from "../Segmenter/SegmenterRegistry.ts"
import type { Trait } from "../Trait.ts"
import type { CheckInput } from "./CheckInput.ts"

/** Completed setup and segmentation shared by all traits in one check. */
export interface Preparation {
  readonly traits: ReadonlyArray<{
    readonly trait: Trait
    readonly enrichments: ReadonlyArray<{
      readonly module: ModuleSpecifier
      readonly execute: Effect.Success<ReturnType<EnrichmentRegistry["Service"]>>
    }>
  }>
  readonly setupDiagnostics: ReadonlyArray<Report.Diagnostic>
  readonly segmentations: ReadonlyMap<
    ModuleSpecifier,
    ReadonlyArray<Result.Result<ReadonlyArray<Segment>, Report.Diagnostic>>
  >
}

/** Collects immutable results; registry layers, not preparation, own setup caching. */
export const make = Effect.fnUntraced(function* (
  request: CheckInput
): Effect.fn.Return<Preparation, never, SegmenterRegistry | EnrichmentRegistry> {
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
      segmenterSetups: Effect.forEach(
        modules.segmenters,
        (module) => {
          const origin = Report.DiagnosticOrigin.cases.SegmenterSetup.make({ module })
          const fallback = Report.Diagnostic.cases.Error.make({ origin, error: "Segmenter initialization failed." })
          return segmenterRegistry(module).pipe(
            Effect.catchTags({
              SegmenterSetupError: (error) =>
                Effect.fail(Report.Diagnostic.cases.Instruction.make({ origin, instruction: error.instruction })),
              SchemaError: () => Effect.fail(fallback)
            }),
            Effect.catchDefect(() => Effect.fail(fallback)),
            Effect.result,
            Effect.map((result) => [module, result] as const)
          )
        },
        { concurrency: "unbounded" }
      ),
      enrichmentSetups: Effect.forEach(
        modules.enrichments,
        (module) => {
          const origin = Report.DiagnosticOrigin.cases.EnrichmentSetup.make({ module })
          const fallback = Report.Diagnostic.cases.Error.make({ origin, error: "Enrichment initialization failed." })
          return enrichmentRegistry(module).pipe(
            Effect.catchTags({
              EnrichmentSetupError: (error) =>
                Effect.fail(Report.Diagnostic.cases.Instruction.make({ origin, instruction: error.instruction })),
              SchemaError: () => Effect.fail(fallback)
            }),
            Effect.catchDefect(() => Effect.fail(fallback)),
            Effect.result,
            Effect.map((result) => [module, result] as const)
          )
        },
        { concurrency: "unbounded" }
      )
    },
    { concurrency: "unbounded" }
  )
  const segmentations = yield* Effect.forEach(
    Array.flatMap(setups.segmenterSetups, (entry) =>
      Result.isSuccess(entry[1]) ? [[entry[0], entry[1].success] as const] : []
    ),
    (entry) => {
      const [module, execute] = entry
      return Effect.forEach(
        request.changes,
        (change, index) => {
          const origin = Report.DiagnosticOrigin.cases.SegmenterExecution.make({ module, change: index })
          const fallback = Report.Diagnostic.cases.Error.make({
            origin,
            error: "Segmentation failed or returned invalid inputs."
          })
          return Segmentation.execute(execute, change).pipe(
            Effect.catchTags({
              SegmenterError: (error) =>
                Effect.fail(Report.Diagnostic.cases.Instruction.make({ origin, instruction: error.instruction })),
              SchemaError: () => Effect.fail(fallback)
            }),
            Effect.catchDefect(() => Effect.fail(fallback)),
            Effect.result
          )
        },
        { concurrency: "unbounded" }
      ).pipe(Effect.map((results) => [module, results] as const))
    },
    { concurrency: "unbounded" }
  )
  const enrichments = pipe(
    setups.enrichmentSetups,
    Array.flatMap((entry) => (Result.isSuccess(entry[1]) ? [[entry[0], entry[1].success] as const] : [])),
    (entries) => new Map(entries)
  )
  return {
    traits: Array.map(request.traits, (trait) => ({
      trait,
      enrichments: Array.flatMap(trait.enrichments ?? [], (module) => {
        const execute = enrichments.get(module)
        return execute === undefined ? [] : [{ module, execute }]
      })
    })),
    setupDiagnostics: [
      ...Array.getFailures(Array.map(setups.segmenterSetups, (entry) => entry[1])),
      ...Array.getFailures(Array.map(setups.enrichmentSetups, (entry) => entry[1]))
    ],
    segmentations: new Map(segmentations)
  }
})
