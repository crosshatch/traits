import { Schema as S } from "effect"

import { Trait } from "../Trait.ts"
import { TraitInputReport } from "./TraitInputReport.ts"

export type TraitReportEntry = typeof TraitReportEntry.Type
export const TraitReportEntry = S.Struct({
  /** The shared static definition, included once for this trait. */
  trait: Trait,
  inputs: S.Array(TraitInputReport)
})
