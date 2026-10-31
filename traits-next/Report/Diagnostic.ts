import { Schema as S } from "effect"

import { ModuleSpecifier, RecoveryInstruction } from "../schema/index.ts"

/** A normalized extension failure reported even when fallback succeeds; interruption is cancellation and creates no diagnostic. */
export type Diagnostic = typeof Diagnostic.Type
export const Diagnostic = S.Struct({
  /** The configured segmenter or enrichment module that failed. */
  module: ModuleSpecifier.annotate({ description: "The configured segmenter or enrichment module that failed." }),
  /** Exactly one nonblank explanation: Error when remediation is unknown, or Instruction when actionable remediation is known. */
  info: S.TaggedUnion({
    Error: {
      /** Safe, normalized failure details when remediation is unknown; excludes raw error objects and source excerpts. */
      error: S.NonEmptyString.check(S.isPattern(/\S/u)).annotate({
        description:
          "Safe, normalized failure details when remediation is unknown; excludes raw error objects and source excerpts."
      }),
      /** Error details and recovery instructions are mutually exclusive. */
      instruction: S.Never.pipe(S.optionalKey)
    },
    Instruction: {
      /** Actionable remediation including relevant failure context, replacing standalone error details. */
      instruction: RecoveryInstruction.annotate({
        description: "Actionable remediation including relevant failure context, replacing standalone error details."
      }),
      /** Recovery instructions replace standalone error details. */
      error: S.Never.pipe(S.optionalKey)
    }
  }).annotate({
    description:
      "Exactly one nonblank explanation: Error when remediation is unknown, or Instruction when actionable remediation is known."
  }),
  /** The extension kind and lifecycle stage: setup origins have no location, segmenter execution references a supplied change, and enrichment execution references a trait-local input. */
  origin: S.TaggedUnion({
    /** Segmenter initialization failed before selecting assessment inputs. */
    SegmenterSetup: {},
    SegmenterExecution: {
      /** Index into the caller's supplied changes in original caller order, before filtering or scheduling; not an input-report index. */
      change: S.Natural.annotate({
        description:
          "Index into the caller's supplied changes in original caller order, before filtering or scheduling; not an input-report index."
      })
    },
    /** Enrichment initialization failed before processing assessment inputs. */
    EnrichmentSetup: {},
    EnrichmentExecution: {
      /** Index into the containing TraitReport.inputs identifying the originating assessment input. */
      input: S.Natural.annotate({
        description: "Index into the containing TraitReport.inputs identifying the originating assessment input."
      })
    }
  }).annotate({
    description:
      "The extension kind and lifecycle stage: setup origins have no location, segmenter execution references a supplied change, and enrichment execution references a trait-local input."
  })
}).annotate({
  description:
    "A normalized extension failure reported even when fallback succeeds; interruption is cancellation and creates no diagnostic."
})
