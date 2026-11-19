import { Array } from "effect"
import { DecisionModel } from "effect/ai"

/** Sums each token count, leaving it unknown if any request omitted it; an empty collection used zero tokens. */
export const sum = (usages: ReadonlyArray<DecisionModel.DecisionUsage>): DecisionModel.DecisionUsage => {
  const total = (key: "inputTokens" | "outputTokens") =>
    Array.every(usages, (usage) => usage[key] !== undefined)
      ? Array.reduce(usages, 0, (count, usage) => count + usage[key]!)
      : undefined
  return DecisionModel.DecisionUsage.make({ inputTokens: total("inputTokens"), outputTokens: total("outputTokens") })
}
