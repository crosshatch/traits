import { Effect, Option, Schema as S } from "effect"
import { Command, Flag } from "effect/cli"

import * as Database from "../Database.ts"
import * as Output from "../Output.ts"
import * as Protocol from "../Protocol.ts"
import * as Query from "../Query.ts"
import { commonFlags } from "./commonFlags.ts"

export const command = (signal: Protocol.Signal) =>
  Command.make(
    signal,
    {
      ...commonFlags,
      errors: Flag.Boolean("errors").pipe(
        Flag.withDefault(false),
        Flag.withDescription("Only error spans or ERROR/FATAL logs")
      ),
      run: Flag.String("run").pipe(
        Flag.withDescription("Exact run ID"),
        Flag.optional,
        Flag.map(Option.getOrUndefined)
      ),
      search: Flag.String("search").pipe(
        Flag.withDescription("Case-insensitive literal substring in record, resource, or scope JSON"),
        Flag.optional,
        Flag.map(Option.getOrUndefined)
      ),
      trace: Flag.String("trace").pipe(
        Flag.withSchema(S.String.check(S.isPattern(/^[0-9a-fA-F]{32}$/))),
        Flag.withDescription("Exact 32-digit hexadecimal trace ID"),
        Flag.optional,
        Flag.map(Option.getOrUndefined)
      )
    },
    Effect.fnUntraced(function* (options) {
      const rows = yield* Query.records(signal, options)
      yield* Output.records(rows, signal, options.json)
    }, Effect.provide(Database.layerLocal))
  ).pipe(
    Command.withDescription(
      signal === "traces" ? "List or search spans, newest ingested first" : "List or search logs, newest ingested first"
    )
  )
