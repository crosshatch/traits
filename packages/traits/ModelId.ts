import { Schema as S } from "effect"

/** The provider's model ID, without whitespace; it may contain slashes, such as anthropic/claude. */
export type ModelId = typeof ModelId.Type
export const ModelId = S.String.check(
  S.isPattern(/^\S+$/u, { message: "Expected a model ID without whitespace." })
).annotate({
  description: "The provider's model ID, without whitespace; it may contain slashes, such as `anthropic/claude`."
})
