import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import { Effect } from "effect"

import Worker from "./src/worker.ts"

export default Alchemy.Stack(
  "crosshatch",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    const worker = yield* Worker

    return { url: worker.url.as<string>() }
  })
)
