import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai"
import { TypeSafeClient, TypeSafeDecisionModel } from "@effect/ai-typesafe"
import { Config, Layer } from "effect"

export default {
  excludes: ["**/dist/**", "node_modules/**", "repos/**"],
  layerDecisionModel: TypeSafeDecisionModel.layer({ model: "jev-latest" }).pipe(
    Layer.provide(TypeSafeClient.layerConfig())
  ),
  layerLanguageModel: OpenAiLanguageModel.layer({
    model: "gpt-6.1-sol",
    config: { reasoning: { effort: "low" } }
  }).pipe(Layer.provide(OpenAiClient.layerConfig({ apiKey: Config.Redacted("OPENAI_API_KEY") })))
}
