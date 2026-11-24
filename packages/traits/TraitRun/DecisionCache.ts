import { Context, Effect, Layer, Option, Schema as S } from "effect"
import { KeyValueStore } from "effect/persistence"

import { StorageError } from "../StorageError.ts"
import { Probability } from "../util/Probability.ts"
import type { DecisionKey } from "./DecisionKey.ts"
import { QuestionId } from "./QuestionId.ts"

/** What is remembered under one key: how likely the model said each question is, by the question's ID. */
export type Answers = typeof Answers.Type
export const Answers = S.Record(QuestionId, Probability).annotate({
  description: "What is remembered under one key: how likely the model said each question is, by the question's ID."
})

/** What the model answered before, kept so that the same question about the same evidence is not asked again. Hosts supply where it is kept. Remembering is only a saving, so whoever asks carries on without what cannot be read or kept. */
export class DecisionCache extends Context.Service<
  DecisionCache,
  {
    /** The answers remembered under a key; none when nothing is remembered under it. */
    readonly recall: (key: DecisionKey) => Effect.Effect<Answers, StorageError>
    /** Adds answers to those remembered under a key, each in place of any remembered for the same question. */
    readonly remember: (key: DecisionKey, answers: Answers) => Effect.Effect<void, StorageError>
  }
>()("traits/TraitRun/DecisionCache") {}

/** A cache that recalls what another remembers and keeps nothing: for what must not add to a cache, such as an estimate, whose answers are made up, and for a host whose storage cannot be written to. */
export const readOnly = (cache: DecisionCache["Service"]) =>
  DecisionCache.of({ recall: cache.recall, remember: () => Effect.void })

/** A cache that keeps what is remembered in a key-value store, as JSON under each key. */
export const make = Effect.gen(function* () {
  const keyValueStore = yield* KeyValueStore.KeyValueStore
  const store = KeyValueStore.toSchemaStore(keyValueStore, Answers)
  const recall = (key: DecisionKey) =>
    store.get(key).pipe(
      Effect.map(Option.getOrElse((): Answers => ({}))),
      Effect.catchTags({
        KeyValueStoreError: (cause) => StorageError.make({ location: key, reason: { _tag: "Unreadable" }, cause }),
        // Something else is kept under the key, which is told apart from nothing being kept under it.
        SchemaError: (cause) => StorageError.make({ location: key, reason: { _tag: "Malformed" }, cause })
      })
    )
  return DecisionCache.of({
    recall,
    remember: (key, answers) =>
      recall(key).pipe(
        // What cannot be read holds nothing that can be added to, so it is replaced.
        Effect.orElseSucceed((): Answers => ({})),
        Effect.flatMap((remembered) => store.set(key, { ...remembered, ...answers })),
        Effect.mapError((cause) => StorageError.make({ location: key, reason: { _tag: "Unwritable" }, cause }))
      )
  })
})

/** Keeps what is remembered in the host's key-value store, as JSON under each key. */
export const layerKeyValueStore = Layer.effect(DecisionCache, make)
