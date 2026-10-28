import { Schema as S } from "effect"
import { DecisionModel, Response } from "effect/ai"

import { Probability } from "../schema/index.ts"

export type TraitDecisionResult = typeof TraitDecisionResult.Type
export const TraitDecisionResult = S.Struct({
  /** The single assertion assessment returned by the decision model. */
  answers: S.Struct({
    /** The assertion's classification and probability distribution. */
    assessment: S.Struct({
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
  }),
  /** Provider-reported token usage. */
  usage: DecisionModel.DecisionUsage,
  /** The provider's response identifier, when reported. */
  id: S.String.pipe(S.optionalKey),
  /** The model that answered, which may differ from the requested alias. */
  modelId: S.String.pipe(S.optionalKey),
  /** Provider-specific response metadata. */
  metadata: Response.ProviderMetadata
})
