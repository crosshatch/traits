import { AnthropicClient, AnthropicLanguageModel } from "@effect/ai-anthropic"
import { CloudflareClient, CloudflareDecisionModel } from "@effect/ai-cloudflare"
import { OpenAiClient, OpenAiDecisionModel, OpenAiLanguageModel } from "@effect/ai-openai"
import * as OpenAiCompatible from "@effect/ai-openai-compat"
import { OpenRouterClient, OpenRouterDecisionModel, OpenRouterLanguageModel } from "@effect/ai-openrouter"
import { Config, Layer, Schema as S } from "effect"

import { ModelId } from "./ModelId.ts"

const OpenAi = S.Struct({ provider: S.Literal("openai"), model: ModelId }).annotate({
  description: "An OpenAI model; the API key is read from OPENAI_API_KEY."
})

const OpenRouter = S.Struct({ provider: S.Literal("openrouter"), model: ModelId }).annotate({
  description: "An OpenRouter model; the API key is read from OPENROUTER_API_KEY."
})

/** Workspace model selections, independent of provider SDK initialization. */
export type ModelConfiguration = typeof ModelConfiguration.Type
export const ModelConfiguration = S.Struct({
  /** A provider and model for free-form generation by extensions. */
  language: S.Union([
    OpenAi,
    S.Struct({ provider: S.Literal("anthropic"), model: ModelId }).annotate({
      description: "An Anthropic model; the API key is read from ANTHROPIC_API_KEY."
    }),
    OpenRouter,
    S.Struct({
      provider: S.Literal("openai-compatible"),
      model: ModelId,
      /** The API base URL, starting with http:// or https://. */
      url: S.URLFromString.check(
        S.makeFilter((url) => url.protocol === "http:" || url.protocol === "https:", {
          message: "Expected a URL starting with http:// or https://."
        })
      ).annotate({ description: "The API base URL, starting with http:// or https://." }),
      /** The environment variable holding the API key; omitted when the server needs none. */
      apiKeyEnv: S.NonEmptyString.annotateKey({
        description: "The environment variable holding the API key; omitted when the server needs none."
      }).pipe(S.optionalKey)
    }).annotate({ description: "A model served by any OpenAI-compatible API, such as a local or self-hosted server." })
  ])
    .annotate({ description: "A provider and model for free-form generation by extensions." })
    .pipe(S.toTaggedUnion("provider")),
  /** A provider and model for trait assessments and subject matching. */
  decision: S.Union([
    OpenAi,
    OpenRouter,
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

const openAiClient = OpenAiClient.layerConfig({ apiKey: Config.Redacted("OPENAI_API_KEY") })
const openRouterClient = OpenRouterClient.layerConfig({ apiKey: Config.Redacted("OPENROUTER_API_KEY") })

/** Language and decision model services for the selected providers; credentials are read from the active ConfigProvider. */
export const layer = (modelConfiguration: ModelConfiguration) =>
  Layer.mergeAll(
    ModelConfiguration.fields.language.match(modelConfiguration.language, {
      openai: ({ model }) => OpenAiLanguageModel.layer({ model }).pipe(Layer.provide(openAiClient)),
      anthropic: ({ model }) =>
        AnthropicLanguageModel.layer({ model }).pipe(
          Layer.provide(AnthropicClient.layerConfig({ apiKey: Config.Redacted("ANTHROPIC_API_KEY") }))
        ),
      openrouter: ({ model }) => OpenRouterLanguageModel.layer({ model }).pipe(Layer.provide(openRouterClient)),
      "openai-compatible": ({ model, url, apiKeyEnv }) =>
        OpenAiCompatible.OpenAiLanguageModel.layer({ model }).pipe(
          Layer.provide(
            OpenAiCompatible.OpenAiClient.layerConfig({
              apiUrl: Config.succeed(url.href),
              ...(apiKeyEnv === undefined ? {} : { apiKey: Config.Redacted(apiKeyEnv) })
            })
          )
        )
    }),
    ModelConfiguration.fields.decision.match(modelConfiguration.decision, {
      openai: ({ model }) => OpenAiDecisionModel.layer({ model }).pipe(Layer.provide(openAiClient)),
      openrouter: ({ model }) => OpenRouterDecisionModel.layer({ model }).pipe(Layer.provide(openRouterClient)),
      cloudflare: ({ model }) =>
        CloudflareDecisionModel.layer({ model }).pipe(Layer.provide(CloudflareClient.layerConfig()))
    })
  )
