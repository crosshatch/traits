import type { DecisionModel } from "effect/ai"

/** The model identity and usage contributed by a decision request, without retaining its outcomes. */
export type DecisionProvenance = Pick<DecisionModel.DecideSettledResponse<Record<string, never>>, "modelId" | "usage">
