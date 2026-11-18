import { AnthropicClient, AnthropicLanguageModel } from "@effect/ai-anthropic"
import { CloudflareClient, CloudflareDecisionModel } from "@effect/ai-cloudflare"
import { OpenAiClient, OpenAiDecisionModel, OpenAiLanguageModel } from "@effect/ai-openai"
import * as OpenAiCompatible from "@effect/ai-openai-compat"
import { OpenRouterClient, OpenRouterDecisionModel, OpenRouterLanguageModel } from "@effect/ai-openrouter"
import { Array, Config, type Context, Layer, Schema as S } from "effect"

import { DecisionModelSelection, LanguageModelSelection, ModelConfiguration } from "./ModelConfiguration.ts"
export { ModelId } from "../ModelId.ts"
export { DecisionModelSelection, LanguageModelSelection, ModelConfiguration as Models } from "./ModelConfiguration.ts"

/** A selected provider's credentials are missing from the environment and the workspace's .env files. */
export class ModelCredentialsError extends S.TaggedError<ModelCredentialsError>()("ModelCredentialsError", {
  /** The provider whose client could not be configured. */
  provider: S.String.annotateKey({ description: "The provider whose client could not be configured." }),
  /** The environment variables the provider reads its credentials from. */
  variables: S.NonEmptyArray(S.String).annotateKey({
    description: "The environment variables the provider reads its credentials from."
  })
}) {
  override get message(): string {
    return `The ${this.provider} model needs ${Array.join(this.variables, " and ")}. Set it in the environment or in a Git-ignored .env at the workspace root (linked worktrees also read the main checkout's .env), never in chat or committed files, then retry.`
  }
}

/** Reports a provider client's missing configuration as the credentials it needs. */
const requiring =
  <I, S>(tag: Context.Key<I, S>, provider: string, variables: Array.NonEmptyReadonlyArray<string>) =>
  <R>(client: Layer.Layer<I, Config.ConfigError, R>) =>
    client.pipe(
      Layer.catchTag("ConfigError", () => Layer.effect(tag, ModelCredentialsError.make({ provider, variables })))
    )

const openAiClient = OpenAiClient.layerConfig({ apiKey: Config.Redacted("OPENAI_API_KEY") }).pipe(
  requiring(OpenAiClient.OpenAiClient, "OpenAI", ["OPENAI_API_KEY"])
)
const anthropicClient = AnthropicClient.layerConfig({ apiKey: Config.Redacted("ANTHROPIC_API_KEY") }).pipe(
  requiring(AnthropicClient.AnthropicClient, "Anthropic", ["ANTHROPIC_API_KEY"])
)
const openRouterClient = OpenRouterClient.layerConfig({ apiKey: Config.Redacted("OPENROUTER_API_KEY") }).pipe(
  requiring(OpenRouterClient.OpenRouterClient, "OpenRouter", ["OPENROUTER_API_KEY"])
)
const cloudflareClient = CloudflareClient.layerConfig().pipe(
  requiring(CloudflareClient.CloudflareClient, "Cloudflare", ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"])
)
const openAiCompatibleClient = (
  selection: Extract<LanguageModelSelection, { readonly provider: "openai-compatible" }>
) =>
  OpenAiCompatible.OpenAiClient.layerConfig({
    apiUrl: Config.succeed(selection.url),
    ...(selection.apiKeyEnv === undefined ? {} : { apiKey: Config.Redacted(selection.apiKeyEnv) })
  }).pipe(
    requiring(OpenAiCompatible.OpenAiClient.OpenAiClient, `OpenAI-compatible (${selection.url})`, [
      selection.apiKeyEnv ?? "an API key variable"
    ])
  )

/** Language and decision model services for the selected providers; credentials are read from the active ConfigProvider. */
export const layer = (models: ModelConfiguration) =>
  Layer.mergeAll(
    LanguageModelSelection.match(models.language, {
      openai: (selection) => OpenAiLanguageModel.layer({ model: selection.model }).pipe(Layer.provide(openAiClient)),
      anthropic: (selection) =>
        AnthropicLanguageModel.layer({ model: selection.model }).pipe(Layer.provide(anthropicClient)),
      openrouter: (selection) =>
        OpenRouterLanguageModel.layer({ model: selection.model }).pipe(Layer.provide(openRouterClient)),
      "openai-compatible": (selection) =>
        OpenAiCompatible.OpenAiLanguageModel.layer({ model: selection.model }).pipe(
          Layer.provide(openAiCompatibleClient(selection))
        )
    }),
    DecisionModelSelection.match(models.decision, {
      openai: (selection) => OpenAiDecisionModel.layer({ model: selection.model }).pipe(Layer.provide(openAiClient)),
      openrouter: (selection) =>
        OpenRouterDecisionModel.layer({ model: selection.model }).pipe(Layer.provide(openRouterClient)),
      cloudflare: (selection) =>
        CloudflareDecisionModel.layer({ model: selection.model }).pipe(Layer.provide(cloudflareClient))
    })
  )
