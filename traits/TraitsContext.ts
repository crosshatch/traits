import { Array, Context, Effect, Layer, Path, pipe, Schema as S, Semaphore } from "effect"

import { getWorktreeRoot } from "./_util/Git.ts"
import { TraitsConfig } from "./TraitsConfig.ts"

export class TraitsContext extends Context.Service<TraitsContext>()("traits/TraitsContext", {
  make: Effect.gen(function* () {
    const path = yield* Path.Path
    const configRoot = yield* getWorktreeRoot
    const url = yield* path.toFileUrl(path.join(configRoot, "traits.ts"))
    const module = yield* Effect.promise(() => import(url.href))
    const config = yield* pipe(module.default, S.decodeUnknownEffect(TraitsConfig))
    const excludes = Array.appendAll(
      Array.flatMap([".git", ".worktrees", "node_modules"], (directory) => [`**/${directory}`, `**/${directory}/**`]),
      Array.map(config.excludes ?? [], (pattern) =>
        path.isAbsolute(pattern) ? path.relative(configRoot, pattern) : pattern
      )
    )
    const semaphore = yield* Semaphore.make(4)
    return { config, configRoot, excludes, semaphore }
  }).pipe(Effect.withSpan("TraitsContext.make"))
}) {
  static readonly layer = this.pipe(
    Effect.map((context) => Layer.mergeAll(context.config.layerDecisionModel, context.config.layerLanguageModel)),
    Layer.unwrap,
    Layer.provideMerge(Layer.effect(this, this.make))
  )
}
