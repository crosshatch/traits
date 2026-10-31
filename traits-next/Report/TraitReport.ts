import { Array, Schema as S } from "effect"

import { Trait } from "../Trait.ts"
import { Diagnostic } from "./Diagnostic.ts"
import { InputReport } from "./InputReport.ts"
import { Recovery } from "./Recovery.ts"

/** A shared trait definition and its input-specific reports. */
export type TraitReport = typeof TraitReport.Type
export const TraitReport = S.Struct({
  /** The shared static definition, included once for this trait. */
  trait: Trait,
  /** Scheduled inputs in deterministic order, including failed or cancelled work. */
  inputs: S.Array(InputReport),
  /** Recognized enrichment recovery signals, stored once with provenance. */
  recoveries: S.Array(Recovery),
  /** Other observed extension failures, including failures recovered by segmentation fallback. */
  diagnostics: S.Array(Diagnostic)
}).check(
  S.makeFilter(
    (report) =>
      Array.every(
        report.recoveries,
        (recovery) => Recovery.guards.Setup(recovery) || recovery.input < report.inputs.length
      ) &&
      Array.every(
        report.diagnostics,
        (diagnostic) =>
          !Diagnostic.fields.origin.guards.EnrichmentExecution(diagnostic.origin) ||
          diagnostic.origin.input < report.inputs.length
      ),
    {
      message:
        "Execution recoveries and enrichment diagnostics must reference an input in their containing trait report."
    }
  )
)
