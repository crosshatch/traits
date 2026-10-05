import * as Alchemy from "alchemy"
import * as Axiom from "alchemy/Axiom"
import * as Cloudflare from "alchemy/Cloudflare"
import { Effect, Layer } from "effect"

import { Ingest } from "./src/Ingest.ts"
import layerWorker, { Worker } from "./src/worker.ts"

export default Alchemy.Stack(
  "crosshatch",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), Axiom.providers()),
    state: Cloudflare.state()
  },
  Effect.gen(function* () {
    yield* Ingest
    const worker = yield* Worker

    return { url: worker.url.as<string>() }
  }).pipe(Effect.provide(layerWorker))
)
