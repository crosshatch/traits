import { Schema as S } from "effect"

import { TraitReportEntry } from "./TraitReportEntry.ts"

/** Input-specific evaluation context grouped by trait for the client. */
export type TraitReport = typeof TraitReport.Type
export const TraitReport = S.Struct({
  /** Selected traits and their input-specific reports. */
  traits: S.Array(TraitReportEntry)
})
