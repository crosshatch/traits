import { Array, Schema as S } from "effect"

import { WorkspacePath } from "../util/WorkspacePath.ts"
import { ChangeReport } from "./ChangeReport.ts"
import { Diagnostic } from "./Diagnostic.ts"
import { EnrichmentOutcome } from "./EnrichmentOutcome.ts"
import { Explanation } from "./Explanation.ts"
import { InputReport } from "./InputReport.ts"
import type { Report } from "./Report.ts"

const location = {
  /** Index into Report.traits. */
  trait: S.Natural.annotate({ description: "Index into Report.traits." }),
  /** Index into Report.changes and the trait report's changes. */
  change: S.Natural.annotate({ description: "Index into Report.changes and the trait report's changes." }),
  /** Index into the evaluated change's inputs. */
  input: S.Natural.annotate({ description: "Index into the evaluated change's inputs." })
}

/** One failure in a report, flattened with its location for clients listing every problem; derived from the report, not stored in it. */
export type Problem = typeof Problem.Type
export const Problem = S.TaggedUnion({
  /** A shared extension failure from Report.diagnostics. */
  Shared: { diagnostic: Diagnostic },
  /** An enrichment failed for one input. */
  Enrichment: {
    ...location,
    /** The configured enrichment module that failed. */
    module: WorkspacePath.annotateKey({ description: "The configured enrichment module that failed." }),
    explanation: Explanation
  },
  /** Assessment failed for one input. */
  Assessment: { ...location, explanation: Explanation }
}).annotate({
  description:
    "One failure in a report, flattened with its location for clients listing every problem; derived from the report, not stored in it."
})

/** Flattens shared diagnostics and per-input failures in deterministic report order. */
export const fromReport = (report: Report): ReadonlyArray<Problem> => [
  ...Array.map(report.diagnostics, (diagnostic) => Problem.cases.Shared.make({ diagnostic })),
  ...Array.flatMap(report.traits, (traitReport, trait) =>
    Array.flatMap(traitReport.changes, (result, change) =>
      ChangeReport.guards.Evaluated(result)
        ? Array.flatMap(result.inputs, (inputReport, input) => [
            ...Array.flatMap(InputReport.guards.Unmatched(inputReport) ? [] : inputReport.enrichments, (enrichment) =>
              EnrichmentOutcome.guards.Failed(enrichment)
                ? [
                    Problem.cases.Enrichment.make({
                      trait,
                      change,
                      input,
                      module: enrichment.module,
                      explanation: enrichment.explanation
                    })
                  ]
                : []
            ),
            ...(InputReport.guards.Failed(inputReport) && inputReport.explanation !== undefined
              ? [Problem.cases.Assessment.make({ trait, change, input, explanation: inputReport.explanation })]
              : [])
          ])
        : []
    )
  )
]
