import { Data } from "effect"

/** An initialization failure with required recovery guidance. */
export class EnrichmentSetupError extends Data.TaggedError("EnrichmentSetupError")<{
  /** How to recover from the failure. */
  readonly instruction: string
}> {
  override get message(): string {
    return `Enrichment initialization failed. ${this.instruction}`
  }
}
