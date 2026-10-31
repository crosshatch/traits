import { Schema as S } from "effect"

import { InputRange, InputSide } from "../schema/index.ts"
import { Assessment } from "./Assessment.ts"
import { EnrichmentReport } from "./EnrichmentReport.ts"

/** A source-free report for one primary assessment location, retaining before/after provenance. */
export type InputReport = typeof InputReport.Type
export const InputReport = S.Struct({
  /** The before or after source version addressed by this report's path and range. */
  side: InputSide.annotate({
    description: "The before or after source version addressed by this report's path and range."
  }),
  /** The evaluated source version's path, which may be historical or deleted; source text is not included. */
  path: S.NonEmptyString.annotate({
    description: "The evaluated source version's path, which may be historical or deleted; source text is not included."
  }),
  /** The primary evaluated range in the selected side's UTF-16 coordinates, not necessarily the current file's contents. */
  range: InputRange.annotateKey({
    description:
      "The primary evaluated range in the selected side's UTF-16 coordinates, not necessarily the current file's contents."
  }),
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
  description: "A source-free report for one primary assessment location, retaining before/after provenance."
})
