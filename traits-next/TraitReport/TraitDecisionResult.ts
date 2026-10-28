import { Schema as S } from "effect"
import { DecisionModel, Response } from "effect/ai"

export type TraitDecisionResult = typeof TraitDecisionResult.Type
export const TraitDecisionResult = S.Struct({
  /** The single assertion assessment returned by the decision model. */
  answers: S.Struct({
    assessment: S.Struct({
      label: S.Literals(["compliant", "violation", "not-applicable", "inconclusive"]),
      probabilities: S.Struct({
        compliant: S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })),
        violation: S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })),
        "not-applicable": S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })),
        inconclusive: S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 }))
      }),
      confidence: S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })).pipe(S.optionalKey)
    })
  }),
  usage: DecisionModel.DecisionUsage,
  id: S.String.pipe(S.optionalKey),
  modelId: S.String.pipe(S.optionalKey),
  metadata: Response.ProviderMetadata
})
