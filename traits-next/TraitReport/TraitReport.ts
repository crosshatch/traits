import { Schema as S } from "effect"

import { TraitReportEntry } from "./TraitReportEntry.ts"

export type TraitReport = typeof TraitReport.Type
export const TraitReport = S.Struct({
  traits: S.Array(TraitReportEntry)
})
