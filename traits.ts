import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai"
import { TypeSafeClient, TypeSafeDecisionModel } from "@effect/ai-typesafe"
import { Config, Layer } from "effect"

export default {
  layerDecisionModel: TypeSafeDecisionModel.layer({ model: "jev-latest" }).pipe(
    Layer.provide(TypeSafeClient.layerConfig())
  ),
  layerLanguageModel: OpenAiLanguageModel.layer({ model: "gpt-4.1" }).pipe(
    Layer.provide(OpenAiClient.layerConfig({ apiKey: Config.Redacted("OPENAI_API_KEY") }))
  )
}
