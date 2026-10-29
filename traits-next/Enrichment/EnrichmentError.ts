import { Data } from "effect"

/** The scope of execution an enrichment requests to skip or halt. */
export type EnrichmentErrorReason = Data.TaggedEnum<{
  /** Skip only the current enrichment. */
  Enrichment: {}
  /** Skip evaluation of the current trait for this input. */
  Input: {}
  /** Skip evaluation of the current trait for all inputs. */
  Trait: {}
  /** Halt all trait evaluations in the current run. */
  Evaluation: {}
}>
export const EnrichmentErrorReason = Data.taggedEnum<EnrichmentErrorReason>()

/** An enrichment control signal with an optional reportable recovery instruction. */
export class EnrichmentError extends Data.TaggedError("EnrichmentError")<{
  /** The scope of execution to skip or halt. */
  readonly reason: EnrichmentErrorReason
  /** A recovery instruction to include in the report when provided. */
  readonly instruction?: string | undefined
}> {
  override get message(): string {
    const message = EnrichmentErrorReason.$match(this.reason, {
      Enrichment: () => "Enrichment skipped.",
      Input: () => "Trait skipped for this input.",
      Trait: () => "Trait skipped for all inputs.",
      Evaluation: () => "Evaluation halted."
    })
    return this.instruction === undefined ? message : `${message} ${this.instruction}`
  }
}
