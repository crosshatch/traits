import * as Cloudflare from "alchemy/Cloudflare"
import * as Http from "alchemy/Http"
import { Effect, Layer } from "effect"
import { HttpRouter } from "effect/http"

import { layerApi } from "./layerApi.ts"

export default class Worker extends Cloudflare.Worker<Worker>()(
  "Worker",
  { main: import.meta.url },
  Effect.gen(function* () {
    const fetch = yield* HttpRouter.toHttpEffect(layerApi.pipe(Layer.provide(Http.Platform)))

    return { fetch }
  })
) {}
