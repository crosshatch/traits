import { LibsqlClient } from "@effect/sql-libsql"
import { pushSchema } from "drizzle-kit/payload/sqlite"
import * as LibsqlDrizzle from "drizzle-orm/effect-libsql"
import { Array, Context, Effect, FileSystem, Layer, Path } from "effect"

import * as ProjectPaths from "./ProjectPaths.ts"
import { relations, T } from "./tables/index.ts"

export class Database extends Context.Service<
  Database,
  LibsqlDrizzle.EffectLibsqlDatabase<typeof relations> & { readonly $client: LibsqlClient.LibsqlClient }
>()("tracewick/Database") {}

export const layer = (filename: string) =>
  Layer.effect(
    Database,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      yield* fs.makeDirectory(path.dirname(filename), { recursive: true })
      const url = yield* path.toFileUrl(filename)
      const client = yield* LibsqlClient.make({ url: url.href })
      yield* client.unsafe("PRAGMA busy_timeout = 10000")
      yield* client.unsafe("PRAGMA journal_mode = WAL")
      yield* client.unsafe("PRAGMA foreign_keys = ON")
      const db = yield* LibsqlDrizzle.makeWithDefaults({ relations }).pipe(
        Effect.provideService(LibsqlClient.LibsqlClient, client)
      )
      // Libsql's write transaction serializes schema discovery and creation.
      yield* Effect.gen(function* () {
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
      }).pipe(client.withTransaction)
      return db
    })
  )

export const layerLocal = ProjectPaths.resolve.pipe(
  Effect.map((paths) => layer(paths.database)),
  Layer.unwrap
)
