import { Schema as S } from "effect"

import { Probability } from "../schema/index.ts"

/** The assertion's classification, probabilities, and optional confidence. */
export type TraitAssessment = typeof TraitAssessment.Type
export const TraitAssessment = S.Struct({
  /** The classification selected by the model. */
  label: S.Literals(["compliant", "violation", "not-applicable", "inconclusive"]),
  /** Model-reported probabilities for each classification. */
  probabilities: S.Struct({
    /** Probability that the input satisfies the assertion. */
    compliant: Probability,
    /** Probability that the input violates the assertion. */
    violation: Probability,
    /** Probability that the trait does not apply to the input. */
    "not-applicable": Probability,
    /** Probability that the available evidence is insufficient for assessment. */
    inconclusive: Probability
  }),
  /** Optional provider-defined confidence, not a calibrated guarantee. */
  confidence: Probability.pipe(S.optionalKey)
})
