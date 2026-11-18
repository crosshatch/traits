import type { Decision, DecisionModel } from "effect/ai"

/** Keyed classification outcomes, including unanswered decisions, and request-wide usage and metadata. */
export type ClassificationResponse<
  Key extends string = string,
  Label extends string = string
> = DecisionModel.DecideSettledResponse<Record<Key, Decision.Classify<Label>>>
