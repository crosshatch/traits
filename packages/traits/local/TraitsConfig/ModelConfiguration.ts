import { CloudflareClient, CloudflareDecisionModel } from "@effect/ai-cloudflare"
import { OpenAiClient, OpenAiDecisionModel } from "@effect/ai-openai"
import { OpenRouterClient, OpenRouterDecisionModel } from "@effect/ai-openrouter"
import { Config, Layer, Schema as S } from "effect"

import { ModelId } from "./ModelId.ts"

export * from "./ModelId.ts"

/** The models a workspace checks traits with, kept in version control so reviewers can see which models are used. */
export type ModelConfiguration = typeof ModelConfiguration.Type
export const ModelConfiguration = S.Struct({
  /** A provider and model for trait assessments and subject matching. */
  decision: S.Union([
    S.Struct({ provider: S.Literal("openai"), model: ModelId }).annotate({
      description: "An OpenAI model; the API key is read from OPENAI_API_KEY."
    }),
    S.Struct({ provider: S.Literal("openrouter"), model: ModelId }).annotate({
      description: "An OpenRouter model; the API key is read from OPENROUTER_API_KEY."
    }),
    S.Struct({ provider: S.Literal("cloudflare"), model: ModelId }).annotate({
      description:
        "A Cloudflare Workers AI model; credentials are read from CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN."
    })
  ])
    .annotate({ description: "A provider and model for trait assessments and subject matching." })
    .pipe(S.toTaggedUnion("provider"))
}).annotate({
  description:
    "The models a workspace checks traits with, kept in version control so reviewers can see which models are used."
})

/** The decision model service for the selected provider; its credentials are read from the active ConfigProvider. */
export const layerDecision = (decision: ModelConfiguration["decision"]) =>
  ModelConfiguration.fields.decision.match(decision, {
    openai: ({ model }) =>
      OpenAiDecisionModel.layer({ model }).pipe(
        Layer.provide(OpenAiClient.layerConfig({ apiKey: Config.Redacted("OPENAI_API_KEY") }))
      ),
    openrouter: ({ model }) =>
      OpenRouterDecisionModel.layer({ model }).pipe(
        Layer.provide(OpenRouterClient.layerConfig({ apiKey: Config.Redacted("OPENROUTER_API_KEY") }))
      ),
    cloudflare: ({ model }) =>
      CloudflareDecisionModel.layer({ model }).pipe(Layer.provide(CloudflareClient.layerConfig()))
  })
