import { Schema as S } from "effect"

import { TraitReport } from "./TraitReport.ts"

/** Input-specific evaluation context grouped by trait for the client. */
export type Report = typeof Report.Type
export const Report = S.Struct({
  /** Selected traits and their input-specific reports. */
  traits: S.Array(TraitReport),
  /** Recovery guidance when the entire evaluation was halted. */
  instruction: S.String.pipe(S.optionalKey)
})
