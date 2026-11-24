import { LibsqlClient } from "@effect/sql-libsql"
import * as LibsqlDrizzle from "drizzle-orm/effect-libsql"
import { Context, Effect, Layer } from "effect"

import { relations, T } from "./tables/traitIndex/index.ts"
import * as TraitDatabase from "./TraitDatabase.ts"

/**
 * Queryable index of the trait Markdown files. Each process owns a private in-memory copy, so
 * concurrent servers in one worktree never share index state; Markdown stays authoritative.
 */
export class TraitIndex extends Context.Service<
  TraitIndex,
  LibsqlDrizzle.EffectLibsqlDatabase<typeof relations> & { readonly $client: LibsqlClient.LibsqlClient }
>()("traits/TraitIndex") {}

export const layer = Layer.effect(
  TraitIndex,
  Effect.gen(function* () {
    const client = yield* TraitDatabase.makeClient("file::memory:", T)
    return yield* LibsqlDrizzle.makeWithDefaults({ relations }).pipe(
      Effect.provideService(LibsqlClient.LibsqlClient, client)
    )
  })
)
