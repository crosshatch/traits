import { Schema as S } from "effect"

import { Trait } from "../Trait.ts"
import { TraitInputReport } from "./TraitInputReport.ts"

/** A shared trait definition and its input-specific reports. */
export type TraitReportEntry = typeof TraitReportEntry.Type
export const TraitReportEntry = S.Struct({
  /** The shared static definition, included once for this trait. */
  trait: Trait,
  /** Input-specific enrichments and decisions associated with this trait. */
  inputs: S.Array(TraitInputReport)
})
