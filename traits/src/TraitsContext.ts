import { Context, Effect, Layer, Path, pipe, Schema as S, Semaphore, String } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

import { TraitsConfig } from "./TraitsConfig.ts"

export class TraitsContext extends Context.Service<TraitsContext>()("traits/TraitsContext", {
  make: Effect.gen(function* () {
    const path = yield* Path.Path
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const root = yield* spawner.string(ChildProcess.make`git rev-parse --show-toplevel`).pipe(Effect.map(String.trim))
    const url = yield* path.toFileUrl(path.join(root, "traits.ts"))
    const module = yield* Effect.promise(() => import(url.href))
    const config = yield* pipe(module.default, S.decodeUnknownEffect(TraitsConfig))
    const semaphore = yield* Semaphore.make(4)
    return { agentId: "local", semaphore, config }
  })
}) {
  static readonly layer = this.pipe(
    Effect.map((context) => Layer.mergeAll(context.config.layerDecisionModel, context.config.layerLanguageModel)),
    Layer.unwrap,
    Layer.provideMerge(Layer.effect(this, this.make))
  )
}
