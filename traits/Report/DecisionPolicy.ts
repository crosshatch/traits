import { Schema as S } from "effect"

import { Probability } from "../util/util.ts"

/** Serializable assessment thresholds, so every environment derives the same verdicts from the same report. */
export type DecisionPolicy = typeof DecisionPolicy.Type
export const DecisionPolicy = S.Struct({
  /** Minimum fail probability rejecting an assessment; checked before acceptance. */
  fail: Probability.annotateKey({
    description: "Minimum fail probability rejecting an assessment; checked before acceptance."
  }),
  /** Minimum probability that the assertion holds or does not apply (pass plus na) accepting an assessment. */
  pass: Probability.annotateKey({
    description:
      "Minimum probability that the assertion holds or does not apply (pass plus na) accepting an assessment."
  })
}).annotate({
  description:
    "Serializable assessment thresholds, so every environment derives the same verdicts from the same report."
})
