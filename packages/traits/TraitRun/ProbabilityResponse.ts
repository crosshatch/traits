import type { Decision, DecisionModel } from "effect/ai"

/** Keyed probability outcomes, including unanswered decisions, and request-wide usage and metadata. */
export type ProbabilityResponse = DecisionModel.DecideSettledResponse<Record<string, Decision.Probability>>
