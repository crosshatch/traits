import { Effect, FileSystem, Layer, Option, Path } from "effect"
import { Digest } from "effect/crypto"
import { KeyValueStore } from "effect/persistence"

import { CachedDecision, DecisionCache } from "../Check/DecisionCache.ts"
import { TextDigest } from "../util/util.ts"
import * as WorkspaceLayout from "./WorkspaceLayout.ts"
import { WorkspaceRoot } from "./WorkspaceRoot.ts"

/** Decisions remembered in the workspace's .agents/traits/.cache directory, which ignores itself in Git, with keys scoped to the decision model that made them so switching models starts afresh. */
export const layer = (model: string) =>
  Layer.effect(
    DecisionCache,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const { directory } = yield* WorkspaceRoot
      const cache = path.join(directory, WorkspaceLayout.cache)
      yield* fs.makeDirectory(cache, { recursive: true })
      // The cache holds local state only, so it ignores itself rather than requiring an entry in the workspace's .gitignore.
      yield* fs.writeFileString(path.join(cache, ".gitignore"), "*\n")
      const store = yield* KeyValueStore.KeyValueStore.pipe(
        Effect.map((store) => KeyValueStore.toSchemaStore(store, CachedDecision)),
        Effect.provide(KeyValueStore.layerFileSystem(path.join(cache, "decisions")))
      )
      const digest = yield* Digest.Digest
      const scoped = (key: TextDigest.TextDigest) =>
        TextDigest.make(`${model}\u0000${key}`).pipe(Effect.provideService(Digest.Digest, digest))
      return DecisionCache.of({
        get: (key) => scoped(key).pipe(Effect.flatMap(store.get), Effect.orElseSucceed(Option.none<CachedDecision>)),
        set: (key, decision) =>
          scoped(key).pipe(
            Effect.flatMap((scopedKey) => store.set(scopedKey, decision)),
            Effect.ignore
          )
      })
    })
  )
