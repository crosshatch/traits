import type { Decision, DecisionModel } from "effect/ai"

/** Keyed classification outcomes, including unanswered decisions, and request-wide usage and metadata. */
export type ClassificationResponse<K extends string, Label extends string> = DecisionModel.DecideSettledResponse<
  Record<K, Decision.Classify<Label>>
>
