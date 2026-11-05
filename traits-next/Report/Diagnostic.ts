import { Schema as S } from "effect"

import { RecoveryInstruction } from "../util/index.ts"
import { DiagnosticOrigin } from "./DiagnosticOrigin.ts"

/** A diagnostic for an observed extension or assessment failure; interruption is cancellation and creates no failure diagnostic. */
export type Diagnostic = typeof Diagnostic.Type
export const Diagnostic = S.TaggedUnion({
  Error: {
    origin: DiagnosticOrigin,
    /** Safe, normalized failure details when remediation is unknown; excludes raw error objects and source excerpts. */
    error: S.NonEmptyString.check(S.isPattern(/\S/u)).annotate({
      description:
        "Safe, normalized failure details when remediation is unknown; excludes raw error objects and source excerpts."
    })
  },
  Instruction: {
    origin: DiagnosticOrigin,
    /** Actionable remediation including relevant failure context, replacing standalone error details. */
    instruction: RecoveryInstruction.annotateKey({
      description: "Actionable remediation including relevant failure context, replacing standalone error details."
    })
  }
}).annotate({
  description:
    "A diagnostic for an observed extension or assessment failure; interruption is cancellation and creates no failure diagnostic."
})
