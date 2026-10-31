import { Array, Schema as S } from "effect"

import { Trait } from "../Trait.ts"
import { Diagnostic } from "./Diagnostic.ts"
import { InputReport } from "./InputReport.ts"
import { Recovery } from "./Recovery.ts"

/** One trait's partial or complete results, with validated recovery and enrichment-diagnostic input references. */
export type TraitReport = typeof TraitReport.Type
export const TraitReport = S.Struct({
  /** The unchanged static trait definition, included once for these results. */
  trait: Trait.annotate({ description: "The unchanged static trait definition, included once for these results." }),
  /** Scheduled assessment inputs in deterministic order, including failed or cancelled work; indices are local to this report, not durable retry identifiers. */
  inputs: S.Array(InputReport).annotate({
    description:
      "Scheduled assessment inputs in deterministic order, including failed or cancelled work; indices are local to this report, not durable retry identifiers."
  }),
  /** Recognized enrichment recovery signals, stored once with their originating module and execution input when applicable. */
  recoveries: S.Array(Recovery).annotate({
    description:
      "Recognized enrichment recovery signals, stored once with their originating module and execution input when applicable."
  }),
  /** Other observed extension failures, including segmenter failures followed by successful fallback; not duplicated in recoveries. */
  diagnostics: S.Array(Diagnostic).annotate({
    description:
      "Other observed extension failures, including segmenter failures followed by successful fallback; not duplicated in recoveries."
  })
})
  .annotate({
    description:
      "One trait's partial or complete results, with validated recovery and enrichment-diagnostic input references."
  })
  .check(
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
