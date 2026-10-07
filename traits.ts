import { TypeSafeClient, TypeSafeDecisionModel } from "@effect/ai-typesafe"
import { Layer } from "effect"

export default {
  groups: {
    local: { _tag: "Local" },
    crosshatch: {
      _tag: "Git",
      url: "git@github.com:crosshatch/traits-store.git",
      auto: true,
      pinBranch: "main"
    }
  },
  layerDecisionModel: TypeSafeDecisionModel.layer({ model: "jev-latest" }).pipe(
    Layer.provide(TypeSafeClient.layerConfig())
  )
}
