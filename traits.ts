import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai"
import { TypeSafeClient, TypeSafeDecisionModel } from "@effect/ai-typesafe"
import { Config, Layer } from "effect"
import type { TraitsConfig } from "traits"

export default {
  excludes: ["repos/**"],
  layerDecisionModel: TypeSafeDecisionModel.layer({ model: "jev-latest" }).pipe(
    Layer.provide(TypeSafeClient.layerConfig())
  ),
  layerLanguageModel: OpenAiLanguageModel.layer({
    model: "gpt-6.1-sol",
    config: { reasoning: { effort: "low" } }
  }).pipe(Layer.provide(OpenAiClient.layerConfig({ apiKey: Config.Redacted("OPENAI_API_KEY") })))
} satisfies TraitsConfig
