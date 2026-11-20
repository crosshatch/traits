import { Array, Function, Schema as S } from "effect"

import type { DecisionPolicy } from "../DecisionPolicy.ts"
import { ChangeReport } from "./ChangeReport.ts"
import { EnrichmentOutcome } from "./EnrichmentOutcome.ts"
import { InputReport } from "./InputReport.ts"
import type { Report } from "./Report.ts"
import { combineVerdicts, Verdict } from "./Verdict.ts"

/** Verdicts derived from a report and policy, aligned with Report.traits, their changes, and their inputs; not stored in the report. */
export type ReportVerdicts = typeof ReportVerdicts.Type
export const ReportVerdicts = S.Struct({
  /** Combined verdict for the whole report, including shared diagnostics. */
  verdict: Verdict.annotateKey({ description: "Combined verdict for the whole report, including shared diagnostics." }),
  /** Per-trait verdicts aligned with Report.traits. */
  traits: S.Array(
    S.Struct({
      /** Combined verdict for the trait across its changes. */
      verdict: Verdict.annotateKey({ description: "Combined verdict for the trait across its changes." }),
      /** Per-change verdicts aligned with the trait report's changes. */
      changes: S.Array(
        S.Struct({
          /** Combined verdict for the change. */
          verdict: Verdict.annotateKey({ description: "Combined verdict for the change." }),
          /** Per-input verdicts aligned with the change's evaluated inputs; empty unless evaluated. */
          inputs: S.Array(Verdict).annotate({
            description: "Per-input verdicts aligned with the change's evaluated inputs; empty unless evaluated."
          })
        })
      ).annotate({ description: "Per-change verdicts aligned with the trait report's changes." })
    })
  ).annotate({ description: "Per-trait verdicts aligned with Report.traits." })
}).annotate({
  description:
    "Verdicts derived from a report and policy, aligned with Report.traits, their changes, and their inputs; not stored in the report."
})

/** Interprets a completed report under an explicit policy, retaining every input, change, and trait verdict. */
export const fromReport: {
  (policy: DecisionPolicy): (report: Report) => ReportVerdicts
  (report: Report, policy: DecisionPolicy): ReportVerdicts
} = Function.dual(2, (report: Report, policy: DecisionPolicy): ReportVerdicts => {
  const inputVerdict = (input: InputReport): Verdict =>
    InputReport.match(input, {
      Completed: (completed): Verdict => {
        const { assessment } = completed
        if (assessment !== undefined && assessment.fail >= policy.fail) {
          return "Fail"
        }
        if (!Array.every(completed.enrichments, EnrichmentOutcome.guards.Succeeded)) {
          return "Incomplete"
        }
        return assessment === undefined || assessment.pass + assessment.na >= policy.pass ? "Pass" : "Inconclusive"
      },
      Unmatched: (): Verdict => "Pass",
      Failed: (): Verdict => "Incomplete",
      Cancelled: (): Verdict => "Incomplete"
    })
  const traits = Array.map(report.traits, (trait) => {
    const changes = Array.map(
      trait.changes,
      (change): { readonly verdict: Verdict; readonly inputs: ReadonlyArray<Verdict> } =>
        ChangeReport.match(change, {
          NotSegmented: () => ({ verdict: "Incomplete" as const, inputs: [] }),
          Evaluated: (evaluated) => {
            const inputs = Array.map(evaluated.inputs, inputVerdict)
            return { verdict: combineVerdicts(inputs), inputs }
          }
        })
    )
    return { verdict: combineVerdicts(Array.map(changes, (change) => change.verdict)), changes }
  })
  return {
    verdict: combineVerdicts([
      ...Array.map(traits, (trait) => trait.verdict),
      ...(report.diagnostics.length > 0 ? (["Incomplete"] as const) : [])
    ]),
    traits
  }
})
