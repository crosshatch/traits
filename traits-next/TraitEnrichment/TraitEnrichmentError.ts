import { Data } from "effect"

/** The scope of execution an enrichment requests to skip or halt. */
export type TraitEnrichmentErrorReason = Data.TaggedEnum<{
  /** Skip only the current enrichment. */
  Enrichment: {}
  /** Skip evaluation of the current trait for this input. */
  Trait: {}
  /** Halt all trait evaluations in the current run. */
  Evaluation: {}
}>
export const TraitEnrichmentErrorReason = Data.taggedEnum<TraitEnrichmentErrorReason>()

/** An enrichment control signal with an optional reportable explanation. */
export class TraitEnrichmentError extends Data.TaggedError("TraitEnrichmentError")<{
  /** The scope of execution to skip or halt. */
  readonly reason: TraitEnrichmentErrorReason
  /** An explanation to include in the evaluation context when provided. */
  readonly explanation?: string | undefined
}> {
  override get message(): string {
    const message = TraitEnrichmentErrorReason.$match(this.reason, {
      Enrichment: () => "Enrichment skipped.",
      Trait: () => "Trait skipped.",
      Evaluation: () => "Evaluation halted."
    })
    return this.explanation === undefined ? message : `${message} ${this.explanation}`
  }
}
