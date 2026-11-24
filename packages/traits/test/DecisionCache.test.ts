import { expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { KeyValueStore } from "effect/persistence"

import * as DecisionCache from "../TraitRun/DecisionCache.ts"
import { DecisionKey } from "../TraitRun/DecisionKey.ts"
import { QuestionId } from "../TraitRun/QuestionId.ts"
import { Probability } from "../util/Probability.ts"

const key = DecisionKey.make("key")
const first = QuestionId.make("first")
const second = QuestionId.make("second")
const P = Probability.make

const store = Layer.provideMerge(DecisionCache.layerKeyValueStore, KeyValueStore.layerMemory)

it.effect("adds answers to those remembered under a key, each in place of any for the same question", () =>
  Effect.gen(function* () {
    const { recall, remember } = yield* DecisionCache.DecisionCache
    const nothing = yield* recall(key)
    expect(nothing).toEqual({})
    yield* remember(key, { [first]: P(0.1) })
    yield* remember(key, { [second]: P(0.9) })
    const both = yield* recall(key)
    expect(both).toEqual({ [first]: 0.1, [second]: 0.9 })
    yield* remember(key, { [first]: P(0.4) })
    const replaced = yield* recall(key)
    expect(replaced).toEqual({ [first]: 0.4, [second]: 0.9 })
    const elsewhere = yield* recall(DecisionKey.make("another"))
    expect(elsewhere).toEqual({})
  }).pipe(Effect.provide(store))
)

it.effect.each([
  ["text that is not JSON", "not json"],
  ["an answer that is not a probability", JSON.stringify({ first: 0.5, second: 2 })]
] as const)("tells %s apart from nothing being remembered, and replaces it", ([, kept]) =>
  Effect.gen(function* () {
    const keyValueStore = yield* KeyValueStore.KeyValueStore
    const { recall, remember } = yield* DecisionCache.DecisionCache
    yield* keyValueStore.set(key, kept)
    const error = yield* Effect.flip(recall(key))
    expect(error).toMatchObject({ _tag: "StorageError", location: key, reason: { _tag: "Malformed" } })
    yield* remember(key, { [second]: P(0.9) })
    const replaced = yield* recall(key)
    expect(replaced).toEqual({ [second]: 0.9 })
  }).pipe(Effect.provide(store))
)

it.effect("recalls what another cache remembers, and keeps nothing, when it is read-only", () =>
  Effect.gen(function* () {
    const kept = yield* DecisionCache.DecisionCache
    yield* kept.remember(key, { [first]: P(0.1) })
    const { recall, remember } = DecisionCache.readOnly(kept)
    yield* remember(key, { [second]: P(0.9) })
    const remembered = yield* recall(key)
    expect(remembered).toEqual({ [first]: 0.1 })
  }).pipe(Effect.provide(store))
)
