import { effect } from "@effect/vitest"
import { Effect, pipe, Schema as S } from "effect"
import { expect } from "vite-plus/test"

import { Policy } from "../store.ts"

effect("decodes policy defaults for absent and undefined fields", () =>
  Effect.gen(function* () {
    const defaults = yield* pipe({}, S.decodeEffect(Policy))
    expect(defaults).toEqual({ retentionHours: 24, maxRecords: 100000, maxBytes: 64 * 1024 * 1024 })
    const partial = yield* pipe({ maxRecords: 2, maxBytes: undefined }, S.decodeEffect(Policy))
    expect(partial).toEqual({ ...defaults, maxRecords: 2 })
  })
)

effect("validates supplied policy values instead of replacing them with defaults", () =>
  Effect.gen(function* () {
    for (const input of [{ maxRecords: 0 }, { maxBytes: -1 }, { retentionHours: Infinity }]) {
      const invalid = yield* pipe(input, S.decodeEffect(Policy), Effect.isFailure)
      expect(invalid).toBe(true)
    }
  })
)
