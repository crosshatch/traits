import { Effect, Layer, Option } from "effect"

import { Cache, type KeyValueShape } from "./Cache.ts"
import { SessionStore } from "./SessionStore.ts"

export const memoryKeyValue = (): KeyValueShape => {
  const entries = new Map<string, string>()
  return {
    get: (key) => Effect.sync(() => Option.fromUndefinedOr(entries.get(key))),
    set: (key, value) => Effect.sync(() => void entries.set(key, value))
  }
}

export const memoryLayer = Layer.mergeAll(
  Layer.sync(Cache, memoryKeyValue),
  Layer.sync(SessionStore, memoryKeyValue)
)
