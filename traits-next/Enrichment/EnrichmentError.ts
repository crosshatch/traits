import { Data, Schema as S } from "effect"

/** The scope of execution an enrichment requests to skip. */
export type EnrichmentErrorReason = typeof EnrichmentErrorReason.Type
export const EnrichmentErrorReason = S.TaggedUnion({
  /** Skip only the current enrichment. */
  Enrichment: {},
  /** Skip evaluation of the current trait for this input. */
  Input: {},
  /** Skip remaining work for this trait because a trait-wide prerequisite is unavailable. */
  Trait: {}
})

/** An enrichment skip signal with required recovery guidance. */
export class EnrichmentError extends Data.TaggedError("EnrichmentError")<{
  /** The scope of execution to skip. */
  readonly reason: EnrichmentErrorReason
  /** Recovery guidance for the requested skip. */
  readonly instruction: string
}> {
  override get message(): string {
    const message = EnrichmentErrorReason.match(this.reason, {
      Enrichment: () => "Enrichment skipped.",
      Input: () => "Trait skipped for this input.",
      Trait: () => "Trait skipped for all inputs."
    })
    return `${message} ${this.instruction}`
  }
}
