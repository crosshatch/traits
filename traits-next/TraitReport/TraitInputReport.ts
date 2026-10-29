import { Schema as S } from "effect"

import { TraitDecisionResult } from "./TraitDecisionResult.ts"
import { TraitReportEnrichment } from "./TraitReportEnrichment.ts"

/** One input's enrichments and optional assertion decision. */
export type TraitInputReport = typeof TraitInputReport.Type
export const TraitInputReport = S.Struct({
  /** Context produced by enrichments for this input. */
  enrichments: S.Array(TraitReportEnrichment),
  /** The complete assertion decision response, when an assertion was evaluated. */
  decision: TraitDecisionResult.pipe(S.optionalKey)
})
