import { TypeSafeClient, TypeSafeDecisionModel } from "@effect/ai-typesafe"
import { Layer } from "effect"

import { type TraitsConfig } from "./tasks/traits/TraitsConfig.ts"

export default {
  layerDecisionModel: TypeSafeDecisionModel.layer({ model: "jev-latest" }).pipe(
    Layer.provide(TypeSafeClient.layerConfig())
  )
} satisfies TraitsConfig
