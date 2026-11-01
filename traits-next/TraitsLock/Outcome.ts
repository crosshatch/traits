import { Schema as S } from "effect"

/** Policy-derived aggregate across assessed segments; GuidanceOnly means the trait has no assertion. */
const AssessmentResult = S.Literals(["Pass", "Fail", "Inconclusive", "NotApplicable", "GuidanceOnly"]).annotate({
  description: "Policy-derived aggregate across assessed segments; GuidanceOnly means the trait has no assertion."
})

/** Execution completeness and assessment are independent; only a complete Pass is initially eligible for reuse. */
export type Outcome = typeof Outcome.Type
export const Outcome = S.TaggedUnion({
  Complete: {
    /** Policy-derived aggregate across assessed segments; GuidanceOnly means the trait has no assertion. */
    assessment: AssessmentResult
  },
  Degraded: {
    /** Policy-derived aggregate across assessed segments; GuidanceOnly means the trait has no assertion. */
    assessment: AssessmentResult,
    /** Stages with failures or omissions despite finishing assessment, including segmentation fallback and enrichment skips. */
    stages: S.NonEmptyArray(S.Literals(["Segmenter", "Enrichment"]))
      .check(S.isUnique())
      .annotate({
        description:
          "Stages with failures or omissions despite finishing assessment, including segmentation fallback and enrichment skips."
      })
  },
  Incomplete: {
    /** Observed causes of unfinished work; multiple concurrent causes are retained rather than selecting a winner. */
    reasons: S.NonEmptyArray(
      S.Literals([
        "Segmenter",
        "Enrichment",
        "Assessment",
        "InputSkip",
        "TraitCancellation",
        "EvaluatorHalt",
        "Interruption",
        "NotStarted"
      ])
    )
      .check(S.isUnique())
      .annotate({
        description:
          "Observed causes of unfinished work; multiple concurrent causes are retained rather than selecting a winner."
      }),
    /** Aggregate of completed assessments only, if any; does not imply the whole evaluation finished. */
    assessment: AssessmentResult.annotateKey({
      description: "Aggregate of completed assessments only, if any; does not imply the whole evaluation finished."
    }).pipe(S.optionalKey)
  }
}).annotate({
  description:
    "Execution completeness and assessment are independent; only a complete Pass is initially eligible for reuse."
})
