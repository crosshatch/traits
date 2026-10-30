import { Data } from "effect"

/** The scope of execution an enrichment requests to skip or halt. */
export type EnrichmentErrorReason = Data.TaggedEnum<{
  /** Skip only the current enrichment. */
  readonly Enrichment: {}
  /** Skip evaluation of the current trait for this input. */
  readonly Input: {}
  /** Skip evaluation of the current trait for all inputs. */
  readonly Trait: {}
  /** Halt all trait evaluations in the current run. */
  readonly Evaluation: {}
}>
export const EnrichmentErrorReason = Data.taggedEnum<EnrichmentErrorReason>()

/** An enrichment skip or halt signal with required recovery guidance. */
export class EnrichmentError extends Data.TaggedError("EnrichmentError")<{
  /** The scope of execution to skip or halt. */
  readonly reason: EnrichmentErrorReason
  /** Recovery guidance for the requested skip or halt. */
  readonly instruction: string
}> {
  override get message(): string {
    const message = EnrichmentErrorReason.$match(this.reason, {
      Enrichment: () => "Enrichment skipped.",
      Input: () => "Trait skipped for this input.",
      Trait: () => "Trait skipped for all inputs.",
      Evaluation: () => "Evaluation halted."
    })
    return `${message} ${this.instruction}`
  }
}
