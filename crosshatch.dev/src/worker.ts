import * as Cloudflare from "alchemy/Cloudflare"
import { Effect } from "effect"
import { HttpRouter } from "effect/http"
import { layerApi } from "./layerApi.ts"

export default class Worker extends Cloudflare.Worker<Worker>()(
  "Worker",
  { main: import.meta.url },
  Effect.gen(function* () {
    // @effect-diagnostics-next-line unstableApiUsage:off
    const fetch = yield* HttpRouter.toHttpEffect(layerApi)
    return { fetch }
  })
) {}
