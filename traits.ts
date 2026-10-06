import { TypeSafeClient, TypeSafeDecisionModel } from "@effect/ai-typesafe"
import { Layer } from "effect"

export default {
  layerDecisionModel: TypeSafeDecisionModel.layer({ model: "jev-latest" }).pipe(
    Layer.provide(TypeSafeClient.layerConfig())
  )
}
