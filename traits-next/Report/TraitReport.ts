import { Array, Schema as S } from "effect"

import { Trait } from "../Trait.ts"
import { InputReport } from "./InputReport.ts"

/** One trait's static definition and partial or complete input results. */
export type TraitReport = typeof TraitReport.Type
export const TraitReport = S.Struct({
  /** The unchanged static trait definition, included once for these results. */
  trait: Trait.annotateKey({ description: "The unchanged static trait definition, included once for these results." }),
  /** Scheduled assessment inputs in deterministic order, including failed or cancelled work; indices are local to this report, not durable retry identifiers. */
  inputs: S.Array(InputReport).annotate({
    description:
      "Scheduled assessment inputs in deterministic order, including failed or cancelled work; indices are local to this report, not durable retry identifiers."
  })
})
  .annotate({
    description: "One trait's static definition and partial or complete input results."
  })
  .check(
    S.makeFilter(
      (report) => {
        const enrichments = new Set(report.trait.enrichments)
        return Array.every(
          report.inputs,
          (input) =>
            (report.trait.assertion !== undefined || input.assessment === undefined) &&
            (input.status === "Completed"
              ? report.trait.assertion === undefined || input.assessment !== undefined
              : input.assessment === undefined) &&
            Array.every(input.enrichments, (enrichment) => enrichments.has(enrichment.module)) &&
            new Set(Array.map(input.enrichments, (enrichment) => enrichment.module)).size === input.enrichments.length
        )
      },
      {
        message:
          "Input enrichments must be configured and unique. Completed assertion inputs require assessments; other execution states and guidance-only inputs must not carry assessments."
      }
    )
  )
