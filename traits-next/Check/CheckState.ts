import { Array, Data } from "effect"

import * as Report from "../Report/index.ts"
import { type Change, type Input, type ModuleSpecifier, toSegment } from "../schema/index.ts"
import type { Trait } from "../Trait.ts"
import type { Preparation } from "./Preparation.ts"

export interface CheckState {
  readonly preparation: Preparation
  readonly changes: ReadonlyArray<Change>
  readonly traits: ReadonlyArray<TraitResult>
}

export type EnrichmentOutcome = Data.TaggedEnum<{
  readonly Completed: { readonly text: string }
  readonly Failed: {
    readonly diagnostic: Report.Diagnostic
    readonly recovery: "Enrichment" | "Input" | "Trait"
  }
  readonly Cancelled: {}
}>
export const EnrichmentOutcome = Data.taggedEnum<EnrichmentOutcome>()
const isCompleted = EnrichmentOutcome.$is("Completed")

export interface EnrichmentResult {
  readonly module: ModuleSpecifier
  readonly outcome: EnrichmentOutcome
}

export interface InputWork {
  readonly change: number
  readonly input: Input
}

export interface TraitWork {
  readonly trait: Trait
  readonly inputs: ReadonlyArray<InputWork>
}

export interface InputResult extends InputWork {
  readonly status: Report.InputStatus
  readonly enrichments: ReadonlyArray<EnrichmentResult>
  readonly assessment?: Report.Assessment | undefined
  readonly diagnostic?: Report.Diagnostic | undefined
}

export interface TraitResult {
  readonly trait: Trait
  readonly inputs: ReadonlyArray<InputResult>
}

/** Assessment and reporting use the same successful contexts, including empty strings. */
export const successfulEnrichments = (results: ReadonlyArray<EnrichmentResult>) =>
  Array.flatMap(results, (entry) =>
    isCompleted(entry.outcome) ? [{ module: entry.module, text: entry.outcome.text }] : []
  )

const inputReport = (input: InputResult): Report.InputReport => ({
  change: input.change,
  segment: toSegment(input.input),
  status: input.status,
  enrichments: successfulEnrichments(input.enrichments),
  ...(input.assessment === undefined ? {} : { assessment: input.assessment })
})

const traitReport = (result: TraitResult): Report.TraitReport => ({
  trait: result.trait,
  inputs: Array.map(result.inputs, inputReport)
})

const inputDiagnostics = (input: InputResult) => [
  ...Array.flatMap(input.enrichments, (entry) =>
    EnrichmentOutcome.$is("Failed")(entry.outcome) ? [entry.outcome.diagnostic] : []
  ),
  ...(input.diagnostic === undefined ? [] : [input.diagnostic])
]

/** Pure projection of completed phases; interruption exits through Effect instead of returning a report. */
export const toReport = (state: CheckState) =>
  Report.Report.make({
    changes: Array.map(state.changes, (change) =>
      change.after === undefined
        ? { before: change.before!.path }
        : { after: change.after.path, ...(change.before === undefined ? {} : { before: change.before.path }) }
    ),
    interrupted: false,
    diagnostics: [
      ...Array.getFailures(state.preparation.segmenters.values()),
      ...Array.getFailures(state.preparation.enrichments.values()),
      ...Array.flatMap(Array.fromIterable(state.preparation.segmented.values()), Array.getFailures),
      ...Array.flatMap(state.traits, (trait) => Array.flatMap(trait.inputs, inputDiagnostics))
    ],
    traits: Array.map(state.traits, traitReport)
  })
