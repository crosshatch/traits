import { Console, Effect, pipe, Schema as S } from "effect"
import { Argument, Command } from "effect/cli"

import * as TraitDatabase from "../TraitDatabase.ts"

export const query = Command.make(
  "query",
  {
    sql: Argument.String("sql").pipe(Argument.withDescription("SQLite statement; results are returned as JSON rows"))
  },
  Effect.fnUntraced(function* (options) {
    const db = yield* TraitDatabase.TraitDatabase
    const rows = yield* db.$client.unsafe(options.sql)
    const json = yield* pipe(rows, S.encodeUnknownEffect(S.fromJsonString(S.Array(S.JsonObject))))
    yield* Console.log(json)
  }, Effect.provide(TraitDatabase.layerLocal))
).pipe(Command.withDescription("Query worktree SQLite tables: spans, logs, runs, and traits"))
