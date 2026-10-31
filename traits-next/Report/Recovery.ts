import { Record, Schema as S } from "effect"

import { EnrichmentErrorReason } from "../Enrichment/index.ts"
import { ModuleSpecifier, RecoveryInstruction } from "../schema/index.ts"

/** A recognized enrichment recovery signal with required instructions; Setup has no input reference and Execution identifies its input and cancellation scope. */
export type Recovery = typeof Recovery.Type
export const Recovery = S.TaggedUnion({
  Setup: {
    /** The enrichment module whose initialization failed. */
    module: ModuleSpecifier.annotate({ description: "The enrichment module whose initialization failed." }),
    /** Nonblank, actionable guidance for resolving a failure before reevaluation. */
    instruction: RecoveryInstruction
  },
  Execution: {
    /** The enrichment module whose execution produced this recovery signal. */
    module: ModuleSpecifier.annotate({
      description: "The enrichment module whose execution produced this recovery signal."
    }),
    /** Enrichment omits this invocation's context; Input prevents this input's assessment and cancels sibling enrichments; Trait cancels remaining work for this trait without invalidating completed assessments. */
    reason: S.Literals(Record.keys(EnrichmentErrorReason.cases)).annotate({
      description:
        "Enrichment omits this invocation's context; Input prevents this input's assessment and cancels sibling enrichments; Trait cancels remaining work for this trait without invalidating completed assessments."
    }),
    /** Index into the containing TraitReport.inputs identifying where this failure originated, not a durable retry identifier. */
    input: S.Natural.annotate({
      description:
        "Index into the containing TraitReport.inputs identifying where this failure originated, not a durable retry identifier."
    }),
    /** Nonblank, actionable guidance for resolving a failure before reevaluation. */
    instruction: RecoveryInstruction
  }
}).annotate({
  description:
    "A recognized enrichment recovery signal with required instructions; Setup has no input reference and Execution identifies its input and cancellation scope."
})
