import { Schema as S } from "effect"

import { SnapshotChangeLocation } from "../schema/index.ts"
import { TraitDecisionResult } from "./TraitDecisionResult.ts"
import { TraitReportEnrichment } from "./TraitReportEnrichment.ts"

export type TraitInputReport = typeof TraitInputReport.Type
export const TraitInputReport = S.Struct({
  /** The input snapshot or region assessed against the trait. */
  location: SnapshotChangeLocation,
  /** Context produced by enrichments for this input. */
  enrichments: S.Array(TraitReportEnrichment),
  /** The complete assertion decision response, when an assertion was evaluated. */
  decision: TraitDecisionResult.pipe(S.optionalKey)
})
