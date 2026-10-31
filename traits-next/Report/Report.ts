import { Schema as S } from "effect"

import { RecoveryInstruction } from "../schema/index.ts"
import { TraitReport } from "./TraitReport.ts"

/** Client-facing evaluation results grouped by trait, without source text or excerpts; retry tracking is external. */
export type Report = typeof Report.Type
export const Report = S.Struct({
  /** Selected traits and their input-specific results, recoveries, and diagnostics in deterministic order. */
  traits: S.Array(TraitReport).annotate({
    description: "Selected traits and their input-specific results, recoveries, and diagnostics in deterministic order."
  }),
  /** Evaluator-owned halt guidance; enrichment failures cannot halt unrelated traits. */
  instruction: RecoveryInstruction.annotate({
    description: "Evaluator-owned halt guidance; enrichment failures cannot halt unrelated traits."
  }).pipe(S.optionalKey)
}).annotate({
  description:
    "Client-facing evaluation results grouped by trait, without source text or excerpts; retry tracking is external."
})
