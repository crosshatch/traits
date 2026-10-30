import { Schema as S } from "effect"

import { RecoveryInstruction } from "../schema/index.ts"
import { TraitReport } from "./TraitReport.ts"

/** Input-specific evaluation context grouped by trait for the client. */
export type Report = typeof Report.Type
export const Report = S.Struct({
  /** Selected traits and their input-specific reports. */
  traits: S.Array(TraitReport),
  /** Evaluator-owned recovery guidance; enrichments cannot halt unrelated traits. */
  instruction: RecoveryInstruction.pipe(S.optionalKey)
})
