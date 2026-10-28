import { Schema as S } from "effect"
import { DecisionModel, Response } from "effect/ai"

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
        compliant: S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })),
        /** Probability that the input violates the assertion. */
        violation: S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })),
        /** Probability that the trait does not apply to the input. */
        "not-applicable": S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })),
        /** Probability that the available evidence is insufficient for assessment. */
        inconclusive: S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 }))
      }),
      /** Optional provider-defined confidence, not a calibrated guarantee. */
      confidence: S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })).pipe(S.optionalKey)
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
