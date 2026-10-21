import { LibsqlClient } from "@effect/sql-libsql"
// Drizzle currently exposes programmatic SQLite schema push through this Payload integration entry point.
// Keep this adapter isolated; revisit when Drizzle offers a stable standalone schema-push API.
import { pushSchema } from "drizzle-kit/payload/sqlite"
import * as LibsqlDrizzle from "drizzle-orm/effect-libsql"
import { Array, Context, Effect, Layer } from "effect"

import { relations, T } from "./tables/index.ts"

export class TraitDatabase extends Context.Service<
  TraitDatabase,
  LibsqlDrizzle.EffectLibsqlDatabase<typeof relations> & { readonly $client: LibsqlClient.LibsqlClient }
>()("traits/TraitDatabase") {}

export const layer = Layer.effect(
  TraitDatabase,
  Effect.gen(function* () {
    const client = yield* LibsqlClient.make({ url: "file::memory:" })
    const db = yield* LibsqlDrizzle.makeWithDefaults({ relations }).pipe(
      Effect.provideService(LibsqlClient.LibsqlClient, client)
    )
    const services = yield* Effect.context<never>()
    const runPromise = Effect.runPromiseWith(services)
    yield* Effect.tryPromise((signal) =>
      pushSchema(T, {
        query: <T>(query: string, params?: Array<unknown>) =>
          client.unsafe(query, params).pipe(
            Effect.map((rows) => Array.fromIterable(rows) as Array<T>),
            (effect) => runPromise(effect, { signal })
          ),
        run: (query) => client.unsafe(query).pipe(Effect.asVoid, (effect) => runPromise(effect, { signal })),
        batch: (statements) =>
          Effect.forEach(statements, (query) => client.unsafe(query), { discard: true }).pipe((effect) =>
            runPromise(effect, { signal })
          )
      }).then((migration) => migration.apply())
    )
    return db
  })
)
