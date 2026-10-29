import { Schema as S } from "effect"

import { Trait } from "../Trait.ts"
import { InputReport } from "./InputReport.ts"

/** A shared trait definition and its input-specific reports. */
export type TraitReport = typeof TraitReport.Type
export const TraitReport = S.Struct({
  /** The shared static definition, included once for this trait. */
  trait: Trait,
  /** Input-specific enrichments and assessments associated with this trait. */
  inputs: S.Array(InputReport),
  /** Recovery guidance when this trait was skipped for all inputs. */
  instruction: S.String.pipe(S.optionalKey)
})
