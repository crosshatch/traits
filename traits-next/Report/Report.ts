import { Array, Schema as S } from "effect"

import { RecoveryInstruction } from "../schema/index.ts"
import { Diagnostic } from "./Diagnostic.ts"
import { DiagnosticOrigin } from "./DiagnosticOrigin.ts"
import { TraitReport } from "./TraitReport.ts"

/** Client-facing evaluation results grouped by trait, without source text or excerpts; retry tracking is external. */
export type Report = typeof Report.Type
export const Report = S.Struct({
  /** Diagnostics included once per report, with locations and explanations for client remediation. */
  diagnostics: S.Array(Diagnostic).annotate({
    description: "Diagnostics included once per report, with locations and explanations for client remediation."
  }),
  /** Selected traits and their input-specific results in deterministic order. */
  traits: S.Array(TraitReport).annotate({
    description: "Selected traits and their input-specific results in deterministic order."
  }),
  /** Evaluator-owned halt guidance; enrichment failures cannot halt unrelated traits. */
  instruction: RecoveryInstruction.annotateKey({
    description: "Evaluator-owned halt guidance; enrichment failures cannot halt unrelated traits."
  }).pipe(S.optionalKey)
})
  .annotate({
    description:
      "Client-facing evaluation results grouped by trait, without source text or excerpts; retry tracking is external."
  })
  .check(
    S.makeFilter(
      (report) =>
        Array.every(report.diagnostics, (diagnostic) =>
          DiagnosticOrigin.match(diagnostic.origin, {
            SegmenterSetup: () => Array.some(report.traits, (trait) => diagnostic.module === trait.trait.segment),
            EnrichmentSetup: () =>
              Array.some(report.traits, (trait) => trait.trait.enrichments?.includes(diagnostic.module) === true),
            SegmenterExecution: (origin) => diagnostic.module === report.traits[origin.trait]?.trait.segment,
            EnrichmentExecution: (origin) => {
              const trait = report.traits[origin.trait]
              return (
                trait !== undefined &&
                trait.trait.enrichments?.includes(diagnostic.module) === true &&
                origin.input < trait.inputs.length
              )
            }
          })
        ),
      {
        message: "Diagnostics must name configured extensions with valid execution locations."
      }
    )
  )
