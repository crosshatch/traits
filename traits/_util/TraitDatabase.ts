import { LibsqlClient } from "@effect/sql-libsql"
import { pushSchema } from "drizzle-kit/payload/sqlite"
import * as LibsqlDrizzle from "drizzle-orm/effect-libsql"
import { Array, Context, Effect, Layer } from "effect"

import { relations, T } from "../tables/index.ts"

export class TraitDatabase extends Context.Service<
  TraitDatabase,
  LibsqlDrizzle.EffectLibsqlDatabase<typeof relations> & { readonly $client: LibsqlClient.LibsqlClient }
>()("traits/_util/TraitDatabase") {}

export const layer = Layer.effect(
  TraitDatabase,
  Effect.gen(function* () {
    const client = yield* LibsqlClient.LibsqlClient
    const db = yield* LibsqlDrizzle.makeWithDefaults({ relations })
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
