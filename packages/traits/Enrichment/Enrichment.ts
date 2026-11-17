import { type Effect, Schema as S } from "effect"

import type { ExtensionServices } from "../ExtensionServices.ts"
import { RecoveryInstruction } from "../util/RecoveryInstruction.ts"
import type { EnrichmentContext } from "./EnrichmentContext.ts"

/**
 * Shared setup producing a per-input context Effect without modifying the trait body.
 * Map expected failures to stage-specific errors with recovery guidance and execution scope.
 * Unexpected defects become runner-normalized diagnostics without inferred recovery targets.
 * R declares additional host services, such as a local WorkspaceRoot, without coupling the core to that host.
 */
export type Enrichment<R = never> = Effect.Effect<
  Effect.Effect<string, EnrichmentError, EnrichmentContext | ExtensionServices | R>,
  EnrichmentSetupError,
  ExtensionServices | R
>

/** Requested execution skip scope: Enrichment skips only this invocation, Input prevents the current input's assessment, and Trait stops remaining work for this trait; unrelated traits are unaffected. */
export type EnrichmentErrorReason = typeof EnrichmentErrorReason.Type
export const EnrichmentErrorReason = S.TaggedUnion({
  /** Skip only the current enrichment. */
  Enrichment: {},
  /** Skip evaluation of the current trait for this input. */
  Input: {},
  /** Skip remaining work for this trait because a trait-wide prerequisite is unavailable. */
  Trait: {}
}).annotate({
  description:
    "Requested execution skip scope: Enrichment skips only this invocation, Input prevents the current input's assessment, and Trait stops remaining work for this trait; unrelated traits are unaffected."
})

/** An enrichment skip signal with required recovery guidance. */
export class EnrichmentError extends S.TaggedError<EnrichmentError>()("EnrichmentError", {
  /** Requested execution skip scope: Enrichment skips only this invocation, Input prevents the current input's assessment, and Trait stops remaining work for this trait; unrelated traits are unaffected. */
  reason: EnrichmentErrorReason,
  /** Nonblank, actionable guidance for resolving a failure before reevaluation. */
  instruction: RecoveryInstruction
}) {
  override get message(): string {
    const message = EnrichmentErrorReason.match(this.reason, {
      Enrichment: () => "Enrichment skipped.",
      Input: () => "Trait skipped for this input.",
      Trait: () => "Trait skipped for all inputs."
    })
    return `${message} ${this.instruction}`
  }
}

/** An initialization failure with required recovery guidance. */
export class EnrichmentSetupError extends S.TaggedError<EnrichmentSetupError>()("EnrichmentSetupError", {
  /** Required guidance for resolving enrichment initialization failure; carries no execution cancellation scope. */
  instruction: RecoveryInstruction.annotateKey({
    description:
      "Required guidance for resolving enrichment initialization failure; carries no execution cancellation scope."
  })
}) {
  override get message(): string {
    return `Enrichment initialization failed. ${this.instruction}`
  }
}

export * from "./EnrichmentContext.ts"
