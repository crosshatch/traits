import { Schema as S } from "effect"

import { Probability } from "../schema/index.ts"

/** The assertion's classification probabilities. */
export type Assessment = typeof Assessment.Type
export const Assessment = S.Struct({
  /** Probability that the input satisfies the assertion. */
  pass: Probability,
  /** Probability that the input violates the assertion. */
  fail: Probability,
  /** Probability that the trait does not apply to the input. */
  na: Probability,
  /** Probability that the available evidence is insufficient for assessment. */
  uncertain: Probability
})
