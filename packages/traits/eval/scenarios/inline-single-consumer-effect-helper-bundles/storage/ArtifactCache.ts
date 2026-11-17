import { Context, Effect, Layer, Option } from "effect"

import { makeCacheHelpers } from "./cacheHelpers.ts"

export class ArtifactCache extends Context.Service<
  ArtifactCache,
  {
    readonly getOrBuild: (key: string, build: Effect.Effect<string>) => Effect.Effect<string>
  }
>()("storage/ArtifactCache") {
  static readonly layer = (directory: string) =>
    Layer.effect(
      this,
      Effect.gen(function* () {
        const cache = yield* makeCacheHelpers(directory)
        return {
          getOrBuild: Effect.fn("ArtifactCache.getOrBuild")(function* (key: string, build: Effect.Effect<string>) {
            const cached = yield* cache.read(key)
            if (Option.isSome(cached)) {
              return cached.value
            }
            const built = yield* build
            yield* cache.write(key, built)
            return built
          })
        }
      })
    )
}
