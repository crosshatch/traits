import { NodeServices } from "@effect/platform-node"
import { LibsqlClient } from "@effect/sql-libsql"
import { expect, it } from "@effect/vitest"
import { and, like } from "drizzle-orm"
import { Effect, FileSystem, Layer, Path, Result } from "effect"
import { Reactivity } from "effect/reactivity"

import { T } from "../tables/index.ts"
import * as Trait from "../Trait.ts"
import * as TraitDatabase from "../TraitDatabase.ts"
import * as TraitDatabaseClient from "../TraitDatabaseClient.ts"

it.effect(
  "preserves table metadata for typed relational queries",
  Effect.fn("test.TraitDatabase.relations")(
    function* () {
      const db = yield* TraitDatabase.TraitDatabase
      const document = Trait.Trait.make({
        name: Trait.TraitName.make("relational-query"),
        subject: "Database metadata.",
        requirement: "Preserve the table metadata in relational queries.",
        applicability: "Database-backed trait storage.",
        purpose: "Keep relational queries typed and executable.",
        context: "Query individual columns. Markdown body with a searchable example.\n"
      })
      yield* db.insert(T.traits).values(document)
      const row = yield* db.query.traits.findFirst({ where: { name: document.name } })
      expect(row).toEqual(document)
      const matches = yield* db
        .select({ name: T.traits.name })
        .from(T.traits)
        .where(and(like(T.traits.subject, "%metadata%"), like(T.traits.context, "%searchable example%")))
      expect(matches).toEqual([{ name: document.name }])
    },
    Effect.provide(
      TraitDatabase.layer.pipe(
        Layer.provide(TraitDatabaseClient.layer),
        Layer.provide(Layer.mergeAll(NodeServices.layer, Reactivity.layer))
      )
    )
  )
)

it.effect(
  "isolates fresh databases and closes connections before removing their temporary directories",
  Effect.fn("test.TraitDatabase.lifecycle")(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const acquire = Effect.gen(function* () {
      const client = yield* LibsqlClient.LibsqlClient
      const db = yield* TraitDatabase.TraitDatabase
      const rows = yield* db.select().from(T.traits)
      expect(rows).toEqual([])
      const config = yield* Effect.succeed(client.config).pipe(
        Effect.filterOrFail(
          (config) => "url" in config,
          () => "Expected a local client URL"
        ),
        Effect.orDie
      )
      return { client, url: config.url }
    }).pipe(
      Effect.provide(
        TraitDatabase.layer.pipe(Layer.provideMerge(TraitDatabaseClient.layer), Layer.provide(Reactivity.layer))
      )
    )
    const first = yield* acquire
    const second = yield* acquire
    expect(first.url.toString()).not.toBe(second.url.toString())
    const filename = yield* path.fromFileUrl(new URL(first.url))
    const exists = yield* fs.exists(path.dirname(filename))
    expect(exists).toBe(false)
    const closed = yield* first.client.unsafe("SELECT 1").pipe(Effect.result)
    expect(Result.isFailure(closed)).toBe(true)
  }, Effect.provide(NodeServices.layer))
)
