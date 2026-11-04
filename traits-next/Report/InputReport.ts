import { Schema as S } from "effect"

import { Segment } from "../schema/index.ts"
import { Assessment } from "./Assessment.ts"
import { EnrichmentReport } from "./EnrichmentReport.ts"
import { InputStatus } from "./InputStatus.ts"

/** A source-free report for one assessment input, referencing the supplied change and preserving its complete segment. */
export type InputReport = typeof InputReport.Type
export const InputReport = S.Struct({
  /** Index into Report.changes in original caller order; resolves before and after source paths. */
  change: S.Natural.annotate({
    description: "Index into Report.changes in original caller order; resolves before and after source paths."
  }),
  /** One primary before/after assessment target, with optional historical context for an after target. */
  segment: Segment,
  /** Execution state, not whether the trait's assertion is satisfied. */
  status: InputStatus.annotateKey({ description: "Execution state, not whether the trait's assertion is satisfied." }),
  /** Successfully produced enrichment contexts only; missing entries do not distinguish failure, cancellation, or unstarted work. */
  enrichments: S.Array(EnrichmentReport).annotate({
    description:
      "Successfully produced enrichment contexts only; missing entries do not distinguish failure, cancellation, or unstarted work."
  }),
  /** Assertion probabilities for a Completed assertion input; absent for guidance-only, Failed, and Cancelled inputs. */
  assessment: Assessment.annotateKey({
    description:
      "Assertion probabilities for a Completed assertion input; absent for guidance-only, Failed, and Cancelled inputs."
  }).pipe(S.optionalKey)
}).annotate({
  description:
    "A source-free report for one assessment input, referencing the supplied change and preserving its complete segment."
})
