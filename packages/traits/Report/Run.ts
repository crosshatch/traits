import { Array, Function, Order, Schema as S } from "effect"

import type { DecisionProvenance } from "../DecisionProvenance.ts"
import * as DecisionUsage from "../DecisionUsage.ts"
import { Probability } from "../util/Probability.ts"

/** Deterministic evaluation provenance, without timestamps, hosts, or absolute paths. */
export type Run = typeof Run.Type
export const Run = S.Struct({
  /** Distinct, sorted model identifiers reported by assessment responses; empty when none were reported. */
  models: S.Array(S.NonEmptyString)
    .check(
      S.isUnique(),
      S.makeFilter(
        (models) => Array.every(models, (model, index) => index === 0 || Order.String(models[index - 1]!, model) <= 0),
        { message: "Model identifiers must be sorted." }
      )
    )
    .annotate({
      description: "Distinct, sorted model identifiers reported by assessment responses; empty when none were reported."
    }),
  /** Token totals across received assessment responses; a total is omitted when any response did not report it. */
  usage: S.Struct({
    /** Total input tokens. */
    inputTokens: S.Natural.annotateKey({ description: "Total input tokens." }).pipe(S.optionalKey),
    /** Total output tokens. */
    outputTokens: S.Natural.annotateKey({ description: "Total output tokens." }).pipe(S.optionalKey)
  }).annotateKey({
    description:
      "Token totals across received assessment responses; a total is omitted when any response did not report it."
  }),
  /** The least subject no probability that ruled a target out: the check.ruleOut setting in effect. */
  ruleOut: Probability.annotateKey({
    description: "The least subject no probability that ruled a target out: the check.ruleOut setting in effect."
  })
}).annotate({ description: "Deterministic evaluation provenance, without timestamps, hosts, or absolute paths." })

/** Derives a run's provenance from the decision responses it received and the rule-out threshold it used: their distinct model identifiers, sorted, and their token totals, each omitted when any response did not report it. */
export const fromResponses: {
  (ruleOut: Probability): (responses: ReadonlyArray<DecisionProvenance>) => Run
  (responses: ReadonlyArray<DecisionProvenance>, ruleOut: Probability): Run
} = Function.dual(2, (responses: ReadonlyArray<DecisionProvenance>, ruleOut: Probability): Run => {
  const usage = DecisionUsage.sum(Array.map(responses, (response) => response.usage))
  return {
    models: Array.sort(
      Array.dedupe(Array.flatMap(responses, (response) => (response.modelId === undefined ? [] : [response.modelId]))),
      Order.String
    ),
    usage: {
      ...(usage.inputTokens === undefined ? {} : { inputTokens: usage.inputTokens }),
      ...(usage.outputTokens === undefined ? {} : { outputTokens: usage.outputTokens })
    },
    ruleOut
  }
})
