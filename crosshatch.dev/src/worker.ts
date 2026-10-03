import * as Cloudflare from "alchemy/Cloudflare"
import * as Http from "alchemy/Http"
import { Effect, Layer } from "effect"
import { HttpRouter } from "effect/http"

import layerAccount, { AccountActor } from "./Account/AccountActor.ts"
import { layerApi } from "./layerApi.ts"

export class Worker extends Cloudflare.Worker<Worker, {}, AccountActor>()("Worker") {}

export default Worker.make(
  { main: import.meta.url },
  Effect.gen(function* () {
    yield* AccountActor.from(Worker)
    const fetch = yield* HttpRouter.toHttpEffect(layerApi.pipe(Layer.provide(Http.Platform)))

    return { fetch }
  }).pipe(Effect.provide(layerAccount))
)
