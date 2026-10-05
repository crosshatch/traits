import * as Cloudflare from "alchemy/Cloudflare"
import * as Http from "alchemy/Http"
import { Context, Effect, Layer, Logger, type Scope, Tracer } from "effect"
import { HttpRouter } from "effect/http"

import layerAccount, { AccountActor } from "./Account/AccountActor.ts"
import * as Ingest from "./Ingest.ts"
import { layerApi } from "./layerApi.ts"

export class Worker extends Cloudflare.Worker<Worker, {}, AccountActor>()("Worker") {}

export default Worker.make(
  { main: import.meta.url },
  Effect.gen(function* () {
    yield* AccountActor.from(Worker)
    // TODO: Remove Effect.updateContext once https://github.com/alchemy-run/alchemy/issues/1956 is resolved.
    const fetch = yield* HttpRouter.toHttpEffect(layerApi.pipe(Layer.provide(Http.Platform))).pipe(
      // HttpApi handlers must inherit telemetry from the request, not Worker initialization.
      Effect.updateContext((context: Context.Context<Scope.Scope>) =>
        Context.omit(Logger.CurrentLoggers, Tracer.Tracer, Tracer.ParentSpan)(context)
      )
    )

    return { fetch }
  }).pipe(Effect.provide([layerAccount, Ingest.layer]))
)
