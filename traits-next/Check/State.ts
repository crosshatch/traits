import { Array, type Effect, type Exit, Predicate, type Types } from "effect"

import type { EnrichmentRegistry } from "../Enrichment/EnrichmentRegistry.ts"
import * as Report from "../Report/index.ts"
import { type Change, type Input, type ModuleSpecifier, type Segment, toSegment } from "../schema/index.ts"
import type { SegmenterRegistry } from "../Segmenter/SegmenterRegistry.ts"
import type { Trait } from "../Trait.ts"

export type Observed<A> = Types.Mutable<{
  readonly exit?: Exit.Exit<A, unknown> | undefined
  readonly diagnostic?: Report.Diagnostic | undefined
}>

export type InputState = Types.Mutable<{
  readonly change: number
  readonly input: Input
  readonly status: Report.InputStatus
  readonly enrichments: Array<
    Types.Mutable<{
      readonly module: ModuleSpecifier
      readonly text?: string | undefined
      readonly diagnostic?: Report.Diagnostic | undefined
    }>
  >
  readonly assessment?: Report.Assessment | undefined
  readonly diagnostic?: Report.Diagnostic | undefined
}>

/** Check-local mutable observations; never shared between checks or stored in registries. */
export const make = (request: { readonly traits: ReadonlyArray<Trait>; readonly changes: ReadonlyArray<Change> }) => {
  const { changes } = request
  const segmenters = new Map<ModuleSpecifier, Observed<Effect.Success<ReturnType<SegmenterRegistry["Service"]>>>>()
  const enrichments = new Map<ModuleSpecifier, Observed<Effect.Success<ReturnType<EnrichmentRegistry["Service"]>>>>()
  const segmented = new Map<ModuleSpecifier, Array<Observed<ReadonlyArray<Segment>>>>()
  const traits = Array.map(
    request.traits,
    (
      trait
    ): Types.Mutable<{ readonly trait: Trait; readonly inputs: Array<InputState>; readonly cancelled: boolean }> => ({
      trait,
      inputs: [],
      cancelled: false
    })
  )
  for (const trait of request.traits) {
    if (trait.segment !== undefined && !segmenters.has(trait.segment)) {
      segmenters.set(trait.segment, {})
      segmented.set(
        trait.segment,
        Array.map(changes, () => ({}))
      )
    }
    for (const module of trait.enrichments ?? []) {
      if (!enrichments.has(module)) {
        enrichments.set(module, {})
      }
    }
  }
  return { segmenters, enrichments, segmented, traits, changes, interrupted: false }
}

export type State = ReturnType<typeof make>

/** Projects settled observations in caller order, without retaining source text in the report. */
export const toReport = (state: State) => {
  const { segmenters, enrichments, segmented, traits, changes, interrupted } = state
  return Report.Report.make({
    changes: Array.map(changes, (change) =>
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
}
