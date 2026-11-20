import { Schema as S } from "effect"

import { ModelId } from "../ModelId.ts"

const OpenAi = S.Struct({ provider: S.Literal("openai"), model: ModelId }).annotate({
  description: "An OpenAI model; the API key is read from OPENAI_API_KEY."
})

const Anthropic = S.Struct({ provider: S.Literal("anthropic"), model: ModelId }).annotate({
  description: "An Anthropic model; the API key is read from ANTHROPIC_API_KEY."
})

const OpenRouter = S.Struct({ provider: S.Literal("openrouter"), model: ModelId }).annotate({
  description: "An OpenRouter model; the API key is read from OPENROUTER_API_KEY."
})

const Cloudflare = S.Struct({ provider: S.Literal("cloudflare"), model: ModelId }).annotate({
  description:
    "A Cloudflare Workers AI model; credentials are read from CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN."
})

const OpenAiCompatible = S.Struct({
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

/** A provider and model for free-form generation by extensions. */
export type LanguageModelSelection = typeof LanguageModelSelection.Type
export const LanguageModelSelection = S.Union([OpenAi, Anthropic, OpenRouter, OpenAiCompatible])
  .annotate({ description: "A provider and model for free-form generation by extensions." })
  .pipe(S.toTaggedUnion("provider"))

/** A provider and model for trait assessments and subject matching. */
export type DecisionModelSelection = typeof DecisionModelSelection.Type
export const DecisionModelSelection = S.Union([OpenAi, OpenRouter, Cloudflare])
  .annotate({ description: "A provider and model for trait assessments and subject matching." })
  .pipe(S.toTaggedUnion("provider"))

/** Workspace model selections, independent of provider SDK initialization. */
export type ModelConfiguration = typeof ModelConfiguration.Type
export const ModelConfiguration = S.Struct({
  language: LanguageModelSelection,
  decision: DecisionModelSelection
}).annotate({
  description:
    "The models a workspace checks traits with, kept in version control so reviewers can see which models are used."
})
