import { Array, Function, Schema as S } from "effect"

import type { Assessment } from "./Assessment.ts"
import { ChangePaths } from "./ChangePaths.ts"
import { Diagnostic } from "./Diagnostic.ts"
import { DiagnosticOrigin } from "./DiagnosticOrigin.ts"
import { TraitReport } from "./TraitReport.ts"

/** Client-facing evaluation results grouped by trait, without source text or excerpts; retry tracking is external. */
export type Report = typeof Report.Type
export const Report = S.Struct({
  /** Paths for every supplied change in original caller order, including changes with no selected inputs. */
  changes: S.Array(ChangePaths).annotate({
    description: "Paths for every supplied change in original caller order, including changes with no selected inputs."
  }),
  /** Diagnostics included once per report, with locations and explanations for client remediation. */
  diagnostics: S.Array(Diagnostic).annotate({
    description: "Diagnostics included once per report, with locations and explanations for client remediation."
  }),
  /** Selected traits and their input-specific results in deterministic order. */
  traits: S.Array(TraitReport).annotate({
    description: "Selected traits and their input-specific results in deterministic order."
  })
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
            SegmenterSetup: (origin) => Array.some(report.traits, (trait) => origin.module === trait.trait.segment),
            EnrichmentSetup: (origin) =>
              Array.some(report.traits, (trait) => trait.trait.enrichments?.includes(origin.module) === true),
            SegmenterExecution: (origin) =>
              origin.change < report.changes.length &&
              Array.some(report.traits, (trait) => origin.module === trait.trait.segment),
            EnrichmentExecution: (origin) => {
              const trait = report.traits[origin.trait]
              return (
                trait !== undefined &&
                trait.trait.enrichments?.includes(origin.module) === true &&
                origin.input < trait.inputs.length
              )
            },
            AssessmentExecution: (origin) => {
              const trait = report.traits[origin.trait]
              return (
                trait !== undefined &&
                trait.trait.assertion !== undefined &&
                trait.inputs[origin.input]?.status === "Failed"
              )
            }
          })
        ),
      {
        message:
          "Extension diagnostics must name configured modules with valid locations; assessment diagnostics must identify a failed assertion input."
      }
    ),
    S.makeFilter(
      (report) =>
        Array.every(report.traits, (trait) =>
          Array.every(trait.inputs, (input) => {
            const change = report.changes[input.change]
            return (
              change !== undefined &&
              (input.segment._tag === "Before"
                ? change.before !== undefined
                : change.after !== undefined &&
                  (input.segment.before === undefined ||
                    input.segment.before.length === 0 ||
                    change.before !== undefined))
            )
          })
        ),
      { message: "Inputs must reference reported changes with paths for all selected source sides." }
    )
  )

/** Whether a runner-produced report has no diagnostics, every input Completed, and every required assessment is accepted by the supplied policy. Interrupted checks return no report. */
export const isPass: {
  (acceptsAssessment: (assessment: Assessment) => boolean): (report: Report) => boolean
  (report: Report, acceptsAssessment: (assessment: Assessment) => boolean): boolean
} = Function.dual(
  2,
  (report: Report, acceptsAssessment: (assessment: Assessment) => boolean): boolean =>
    report.diagnostics.length === 0 &&
    Array.every(report.traits, (traitReport) =>
      Array.every(
        traitReport.inputs,
        (input) =>
          input.status === "Completed" &&
          (traitReport.trait.assertion === undefined ||
            (input.assessment !== undefined && acceptsAssessment(input.assessment)))
      )
    )
)
