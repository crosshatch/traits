import { Schema as S } from "effect"

import { Segment } from "../schema/index.ts"
import { Assessment } from "./Assessment.ts"
import { EnrichmentReport } from "./EnrichmentReport.ts"

/** A source-free report for one assessment input, referencing the supplied change and preserving its complete segment. */
export type InputReport = typeof InputReport.Type
export const InputReport = S.Struct({
  /** Index into the caller's supplied changes in original caller order, before filtering or scheduling; resolves source paths and versions. */
  change: S.Natural.annotate({
    description:
      "Index into the caller's supplied changes in original caller order, before filtering or scheduling; resolves source paths and versions."
  }),
  /** One primary before/after assessment target, with optional historical context for an after target. */
  segment: Segment,
  /** Successfully produced enrichment contexts only; missing entries do not distinguish failure, cancellation, or unstarted work. */
  enrichments: S.Array(EnrichmentReport).annotate({
    description:
      "Successfully produced enrichment contexts only; missing entries do not distinguish failure, cancellation, or unstarted work."
  }),
  /** Assertion probabilities when assessment completed; omission alone does not indicate failure, since guidance-only traits have no assessment. */
  assessment: Assessment.annotate({
    description:
      "Assertion probabilities when assessment completed; omission alone does not indicate failure, since guidance-only traits have no assessment."
  }).pipe(S.optionalKey)
}).annotate({
  description:
    "A source-free report for one assessment input, referencing the supplied change and preserving its complete segment."
})
