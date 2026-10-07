import { TypeSafeClient, TypeSafeDecisionModel } from "@effect/ai-typesafe"
import { Layer } from "effect"

export default {
  groups: {
    local: { _tag: "Local", description: "Project-specific conventions for crosshatch-next" },
    crosshatch: {
      _tag: "Git",
      description: "Shared conventions for Crosshatch projects",
      url: "git@github.com:crosshatch/traits-store.git",
      auto: true,
      pin: "main"
    }
  },
  layerDecisionModel: TypeSafeDecisionModel.layer({ model: "jev-latest" }).pipe(
    Layer.provide(TypeSafeClient.layerConfig())
  )
}
