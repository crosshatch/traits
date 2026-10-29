import { Schema as S } from "effect"

import { TraitAssessment } from "./TraitAssessment.ts"
import { TraitReportEnrichment } from "./TraitReportEnrichment.ts"

/** One input's enrichments and optional assertion assessment. */
export type TraitInputReport = typeof TraitInputReport.Type
export const TraitInputReport = S.Struct({
  /** Context produced by enrichments for this input. */
  enrichments: S.Array(TraitReportEnrichment),
  /** The assertion assessment, when an assertion was evaluated. */
  assessment: TraitAssessment.pipe(S.optionalKey)
})
