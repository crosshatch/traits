import { Layer, Schema as S } from "effect"
import { DecisionModel, LanguageModel } from "effect/ai"
import { HttpClient } from "effect/http"

export type TraitsConfig = typeof TraitsConfig.Type
export const TraitsConfig = S.Struct({
  excludes: S.Array(S.NonEmptyString).pipe(S.optional).annotate({
    description:
      "Filenames or native filesystem glob patterns excluded from trait checks, relative to traits.ts or absolute. Use directory/** to exclude a subtree. Bare directories are not expanded; escape glob characters in literal filenames using native glob syntax."
  }),
  layerDecisionModel: S.declare(
    (value): value is Layer.Layer<DecisionModel.DecisionModel, Error, HttpClient.HttpClient> => Layer.isLayer(value)
  ),
  layerLanguageModel: S.declare(
    (value): value is Layer.Layer<LanguageModel.LanguageModel, Error, HttpClient.HttpClient> => Layer.isLayer(value)
  )
})
