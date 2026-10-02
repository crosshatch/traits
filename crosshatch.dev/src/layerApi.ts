import { CrosshatchApi } from "crosshatch/api"
import { Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/http-api"

const HealthLive = HttpApiBuilder.group(CrosshatchApi, "health", (handlers) =>
  handlers.handle("health", () => Effect.succeed("ok"))
)

export const layerApi = HttpApiBuilder.layer(CrosshatchApi).pipe(Layer.provide(HealthLive))
