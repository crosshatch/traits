import { Array, Schema as S } from "effect"

import { Trait } from "../Trait.ts"
import { InputReport } from "./InputReport.ts"
import { Recovery } from "./Recovery.ts"

/** A shared trait definition and its input-specific reports. */
export type TraitReport = typeof TraitReport.Type
export const TraitReport = S.Struct({
  /** The shared static definition, included once for this trait. */
  trait: Trait,
  /** Scheduled inputs in deterministic order, including failed or cancelled work. */
  inputs: S.Array(InputReport),
  /** Every observed failure, including concurrent failures, stored once with provenance. */
  recoveries: S.Array(Recovery)
}).check(
  S.makeFilter(
    (report) =>
      Array.every(
        report.recoveries,
        (recovery) => Recovery.guards.Setup(recovery) || recovery.input < report.inputs.length
      ),
    { message: "An execution recovery must reference an input in its containing trait report." }
  )
)
