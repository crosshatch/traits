import { Record, Schema as S, Tuple } from "effect"

import { ModuleSpecifier, RecoveryInstruction } from "../schema/index.ts"
import { DiagnosticOrigin } from "./DiagnosticOrigin.ts"

/** A diagnostic for an observed extension failure, even when fallback succeeds; interruption is cancellation and creates no diagnostic. */
export type Diagnostic = typeof Diagnostic.Type
export const Diagnostic = S.TaggedUnion({
  Error: {
    /** Safe, normalized failure details when remediation is unknown; excludes raw error objects and source excerpts. */
    error: S.NonEmptyString.check(S.isPattern(/\S/u)).annotate({
      description:
        "Safe, normalized failure details when remediation is unknown; excludes raw error objects and source excerpts."
    })
  },
  Instruction: {
    /** Actionable remediation including relevant failure context, replacing standalone error details. */
    instruction: RecoveryInstruction.annotate({
      description: "Actionable remediation including relevant failure context, replacing standalone error details."
    })
  }
})
  .pipe((schema) => S.Union(Record.values(schema.cases)))
  .mapMembers(
    Tuple.map(
      S.fieldsAssign({
        /** The configured segmenter or enrichment module that failed. */
        module: ModuleSpecifier.annotate({ description: "The configured segmenter or enrichment module that failed." }),
        /** The extension kind and lifecycle stage: setup origins have no location, segmenter execution references a supplied change, and enrichment execution references a trait-local input. */
        origin: DiagnosticOrigin
      })
    )
  )
  .annotate({
    description:
      "A diagnostic for an observed extension failure, even when fallback succeeds; interruption is cancellation and creates no diagnostic."
  })
  .pipe(S.toTaggedUnion("_tag"))
