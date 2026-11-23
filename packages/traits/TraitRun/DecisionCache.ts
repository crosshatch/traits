import { Context, Effect, Layer, Option, Schema as S } from "effect"
import { KeyValueStore } from "effect/persistence"

import { Probability } from "../util/Probability.ts"

/** What the model answered before, kept so that the same question about the same evidence is not asked again. Remembering is only a saving, so neither operation fails: what cannot be read is not remembered, and what cannot be kept is asked about again. Hosts supply where it is kept. */
export class DecisionCache extends Context.Service<
  DecisionCache,
  {
    /** The probabilities remembered under a key, by the ID of each question; none when nothing is remembered under it. */
    readonly recall: (key: string) => Effect.Effect<Readonly<Record<string, number>>>
    /** Keeps these probabilities under the key, in place of what was remembered under it. */
    readonly remember: (key: string, probabilities: Readonly<Record<string, number>>) => Effect.Effect<void>
  }
>()("traits/TraitRun/DecisionCache") {}

/** Keeps what is remembered in the host's key-value store, as JSON under each key. */
export const layerKeyValueStore = Effect.gen(function* () {
  const keyValueStore = yield* KeyValueStore.KeyValueStore
  const store = KeyValueStore.toSchemaStore(keyValueStore, S.Record(S.String, Probability))
  return DecisionCache.of({
    // A store that cannot be read, or that holds something else under the key, remembers nothing.
    recall: (key) =>
      store.get(key).pipe(
        Effect.map(Option.getOrElse((): Readonly<Record<string, number>> => ({}))),
        Effect.orElseSucceed((): Readonly<Record<string, number>> => ({}))
      ),
    remember: (key, probabilities) => Effect.ignore(store.set(key, probabilities))
  })
}).pipe(Layer.effect(DecisionCache))
