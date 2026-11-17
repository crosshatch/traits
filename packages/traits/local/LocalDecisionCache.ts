import { Array, Clock, Duration, Effect, FileSystem, Layer, Option, Path } from "effect"
import { Digest } from "effect/crypto"
import { KeyValueStore } from "effect/persistence"

import { CachedDecision, DecisionCache } from "../Check/DecisionCache.ts"
import { digestText, TextDigest } from "../util/TextDigest.ts"
import * as WorkspaceLayout from "./WorkspaceLayout.ts"
import { WorkspaceRoot } from "./WorkspaceRoot.ts"

/** How long one generation of remembered decisions lasts. A decision is dropped once a whole generation passes without a check using it, so the cache holds what recent checks needed rather than growing without bound. */
const generation = Duration.days(30)

/**
 * Decisions remembered in the workspace's .agents/traits/.cache directory, which ignores itself in Git, with keys
 * scoped to the decision model that made them so switching models starts afresh. Decisions are kept in generations:
 * a decision found only in the previous generation moves to the current one, and older generations are deleted. If
 * the directory cannot be prepared, such as in a read-only checkout, checks run without remembering decisions.
 */
export const layer = (model: string) =>
  Layer.effect(
    DecisionCache,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const { directory } = yield* WorkspaceRoot
      const cache = path.join(directory, WorkspaceLayout.cache)
      const generations = path.join(cache, "generations")
      yield* fs.makeDirectory(generations, { recursive: true })
      // The cache holds local state only, so it ignores itself rather than requiring an entry in the workspace's .gitignore.
      yield* fs.writeFileString(path.join(cache, ".gitignore"), "*\n")
      const current = yield* Clock.currentTimeMillis.pipe(
        Effect.map((now) => Math.floor(now / Duration.toMillis(generation)))
      )
      const expired = yield* fs
        .readDirectory(generations)
        .pipe(Effect.map(Array.filter((name) => name !== `${current}` && name !== `${current - 1}`)))
      // At most a few directories: one per generation that has passed since the last check.
      yield* Effect.forEach(expired, (name) => fs.remove(path.join(generations, name), { recursive: true }), {
        concurrency: 1,
        discard: true
      })
      const store = (name: string) =>
        KeyValueStore.KeyValueStore.pipe(
          Effect.map((store) => KeyValueStore.toSchemaStore(store, CachedDecision)),
          Effect.provide(KeyValueStore.layerFileSystem(path.join(generations, name)))
        )
      const { fresh, previous } = yield* Effect.all(
        { fresh: store(`${current}`), previous: store(`${current - 1}`) },
        // Two fixed effects.
        { concurrency: "unbounded" }
      )
      const digest = yield* Digest.Digest
      const scoped = (key: TextDigest) =>
        digestText(`${model}\u0000${key}`).pipe(Effect.provideService(Digest.Digest, digest))
      return DecisionCache.of({
        get: Effect.fnUntraced(
          function* (key: TextDigest) {
            const scopedKey = yield* scoped(key)
            const recent = yield* fresh.get(scopedKey)
            if (Option.isSome(recent)) {
              return recent
            }
            const earlier = yield* previous.get(scopedKey)
            // A decision still in use moves to the current generation, so it outlives the previous one.
            yield* Option.match(earlier, {
              onNone: () => Effect.void,
              onSome: (decision) => Effect.ignore(fresh.set(scopedKey, decision))
            })
            return earlier
          },
          Effect.orElseSucceed(Option.none<CachedDecision>)
        ),
        set: (key, decision) =>
          scoped(key).pipe(
            Effect.flatMap((scopedKey) => fresh.set(scopedKey, decision)),
            Effect.ignore
          )
      })
    }).pipe(
      Effect.tapError((error) =>
        Effect.logWarning("The decision cache is unavailable, so no decision is remembered", error)
      ),
      Effect.orElseSucceed(() => DecisionCache.of({ get: () => Effect.succeedNone, set: () => Effect.void }))
    )
  )
