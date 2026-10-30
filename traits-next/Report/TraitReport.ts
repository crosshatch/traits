import { Schema as S } from "effect"

import { Trait } from "../Trait.ts"
import { InputReport } from "./InputReport.ts"
import { Recovery } from "./Recovery.ts"

/** A shared trait definition and its input-specific reports. */
export type TraitReport = typeof TraitReport.Type
export const TraitReport = S.Struct({
  /** The shared static definition, included once for this trait. */
  trait: Trait,
  /** Input-specific enrichments and assessments associated with this trait. */
  inputs: S.Array(InputReport),
  /** Every observed failure, including concurrent failures, stored once with provenance. */
  recoveries: S.Array(Recovery)
})
