import { Schema as S } from "effect"

/** An initialization failure with required recovery guidance. */
export class EnrichmentSetupError extends S.TaggedError<EnrichmentSetupError>()("EnrichmentSetupError", {
  /** How to recover from the failure. */
  instruction: S.String
}) {
  override get message(): string {
    return `Enrichment initialization failed. ${this.instruction}`
  }
}
