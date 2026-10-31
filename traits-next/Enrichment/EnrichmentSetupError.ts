import { Schema as S } from "effect"

import { RecoveryInstruction } from "../schema/index.ts"

/** An initialization failure with required recovery guidance. */
export class EnrichmentSetupError extends S.TaggedError<EnrichmentSetupError>()("EnrichmentSetupError", {
  /** Required guidance for resolving enrichment initialization failure; carries no execution cancellation scope. */
  instruction: RecoveryInstruction.annotate({
    description:
      "Required guidance for resolving enrichment initialization failure; carries no execution cancellation scope."
  })
}) {
  override get message(): string {
    return `Enrichment initialization failed. ${this.instruction}`
  }
}
