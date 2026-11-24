import { Context, Effect, Layer, Semaphore } from "effect"
import type { SqlError } from "effect/sql/SqlError"

import { TraitDatabase } from "./TraitDatabase.ts"

/** Serializes trait file writes across every Traits process in a worktree. */
export class TraitWriteLock extends Context.Service<
  TraitWriteLock,
  {
    readonly withLock: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E | SqlError, R>
  }
>()("traits/TraitWriteLock") {}

/**
 * Holds SQLite's write lock on the shared worktree database: transactions begin with
 * `BEGIN IMMEDIATE`, contenders wait through `busy_timeout`, and the OS releases the lock if the
 * holder exits, so no stale-lock recovery is needed.
 */
export const layer = Layer.effect(
  TraitWriteLock,
  Effect.gen(function* () {
    const db = yield* TraitDatabase
    return { withLock: db.$client.withTransaction }
  })
)

/** Process-local lock for isolated stores. */
export const layerMemory = Layer.effect(
  TraitWriteLock,
  Effect.gen(function* () {
    const semaphore = yield* Semaphore.make(1)
    return { withLock: semaphore.withPermits(1) }
  })
)
