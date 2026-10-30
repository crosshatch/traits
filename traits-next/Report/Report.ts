import { Schema as S } from "effect"

import { TraitReport } from "./TraitReport.ts"

/** Input-specific evaluation context grouped by trait for the client. */
export type Report = typeof Report.Type
export const Report = S.Struct({
  /** Selected traits and their input-specific reports. */
  traits: S.Array(TraitReport),
  /** Present exactly when evaluation halted; contains the required recovery guidance. */
  instruction: S.String.pipe(S.optionalKey)
})
