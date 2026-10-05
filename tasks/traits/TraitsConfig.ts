import { Effect, Layer, Schema as S } from "effect"
import { DecisionModel } from "effect/ai"
import { HttpClient } from "effect/http"

export type TraitsConfig = typeof TraitsConfig.Encoded
export const TraitsConfig = S.Struct({
  passThreshold: S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })).pipe(
    S.withDecodingDefault(Effect.succeed(0.9))
  ),
  layerDecisionModel: S.declare(
    (value): value is Layer.Layer<DecisionModel.DecisionModel, Error, HttpClient.HttpClient> => Layer.isLayer(value)
  )
})
