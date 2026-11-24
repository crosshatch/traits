import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { and, like } from "drizzle-orm"
import { Effect, Layer, Result } from "effect"
import { Reactivity } from "effect/reactivity"

import { T } from "../tables/traitIndex/index.ts"
import * as Trait from "../Trait.ts"
import * as TraitIndex from "../TraitIndex.ts"

it.effect(
  "preserves table metadata for typed relational queries",
  Effect.fn("test.TraitIndex.relations")(
    function* () {
      const db = yield* TraitIndex.TraitIndex
      const document = Trait.Trait.make({
        name: Trait.TraitName.make("relational-query"),
        subject: "Database metadata.",
        requirement: "Preserve the table metadata in relational queries.",
        applicability: "Database-backed trait storage.",
        purpose: "Keep relational queries typed and executable.",
        context: "Query individual columns. Markdown body with a searchable example.\n"
      })
      const version = "content-hash"
      yield* db.insert(T.traits).values({ ...document, version })
      const row = yield* db.query.traits.findFirst({ where: { name: document.name } })
      expect(row).toEqual({ ...document, version })
      const matches = yield* db
        .select({ name: T.traits.name })
        .from(T.traits)
        .where(and(like(T.traits.subject, "%metadata%"), like(T.traits.context, "%searchable example%")))
      expect(matches).toEqual([{ name: document.name }])
    },
    Effect.provide(TraitIndex.layer.pipe(Layer.provide(Layer.mergeAll(NodeServices.layer, Reactivity.layer))))
  )
)

it.effect(
  "isolates in-memory databases and closes their connections",
  Effect.fn("test.TraitIndex.lifecycle")(function* () {
    const acquire = Effect.gen(function* () {
      const db = yield* TraitIndex.TraitIndex
      const client = db.$client
      const rows = yield* db.select().from(T.traits)
      expect(rows).toEqual([])
      yield* db.insert(T.traits).values({
        name: "isolated",
        subject: "Storage.",
        requirement: "Isolate connections.",
        purpose: "Avoid shared state.",
        version: "content-hash"
      })
      const config = yield* Effect.succeed(client.config).pipe(
        Effect.filterOrFail(
          (config) => "url" in config,
          () => "Expected a local client URL"
        ),
        Effect.orDie
      )
      return { client, url: config.url }
    }).pipe(Effect.provide(TraitIndex.layer.pipe(Layer.provide(Reactivity.layer))))
    const first = yield* acquire
    const second = yield* acquire
    expect(first.url.toString()).toBe("file::memory:")
    expect(second.url.toString()).toBe("file::memory:")
    const closed = yield* first.client.unsafe("SELECT 1").pipe(Effect.result)
    expect(Result.isFailure(closed)).toBe(true)
  }, Effect.provide(NodeServices.layer))
)
