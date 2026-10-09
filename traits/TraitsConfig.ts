import { Layer, Schema as S } from "effect"
import { DecisionModel, LanguageModel } from "effect/ai"
import { HttpClient } from "effect/http"

export type TraitsConfig = typeof TraitsConfig.Type
export const TraitsConfig = S.Struct({
  layerDecisionModel: S.declare(
    (value): value is Layer.Layer<DecisionModel.DecisionModel, Error, HttpClient.HttpClient> => Layer.isLayer(value)
  ),
  layerLanguageModel: S.declare(
    (value): value is Layer.Layer<LanguageModel.LanguageModel, Error, HttpClient.HttpClient> => Layer.isLayer(value)
  )
})
