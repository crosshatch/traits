import { SqliteClient } from "@effect/sql-sqlite-node"
import { sql } from "drizzle-orm"
import * as Drizzle from "drizzle-orm/effect-sqlite-node"
import { Array, Context, Effect, Layer } from "effect"

import type { CaptureGroup } from "./project.ts"
import * as tables from "./tables.ts"
import * as TelemetryState from "./TelemetryState.ts"

export interface DatabaseService {
  readonly db: Drizzle.EffectSQLiteNodeDatabase
  readonly transaction: SqliteClient.SqliteClient["withTransaction"]
}

const make = Effect.fn("Database.make")(function* (group: CaptureGroup, fresh: boolean) {
  const db = yield* Drizzle.makeWithDefaults()
  if (fresh) {
    // Drizzle Kit's headless API is Promise-based; keep this bridge at that boundary.
    const kit = yield* Effect.promise(() => import("drizzle-kit/payload/sqlite"))
    const context = yield* Effect.context<never>()
    const run = Effect.runPromiseWith(context)
    yield* Effect.tryPromise((signal) =>
      kit
        .pushSchema(tables, {
          query: <T>(statement: string, params?: unknown[]) =>
            run(db.$client.unsafe<T & object>(statement, params).pipe(Effect.map(Array.fromIterable)), { signal }),
          run: (statement: string) => run(db.run(sql.raw(statement)).pipe(Effect.asVoid), { signal }),
          batch: (statements: string[]) =>
            run(
              db.$client.withTransaction(
                Effect.forEach(statements, (statement) => db.run(sql.raw(statement)), { discard: true })
              ),
              { signal }
            )
        })
        .then((plan) => plan.apply())
    )
    yield* TelemetryState.recordVersion(group)
  }
  // rc5's transaction declarations still reference Effect's removed unstable/sql path.
  // Use the driver's typed transaction primitive until those declarations are fixed.
  return { db, transaction: db.$client.withTransaction } satisfies DatabaseService
})

export class Database extends Context.Service<Database, DatabaseService>()("tracewick/database") {}
export const layer = (group: CaptureGroup) =>
  Effect.gen(function* () {
    const state = yield* TelemetryState.inspect(group)
    return Layer.effect(Database, make(group, state.fresh)).pipe(
      Layer.provide(SqliteClient.layer({ filename: `${group.state}/telemetry.sqlite` }))
    )
  }).pipe(Layer.unwrap)
