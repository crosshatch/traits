import { Effect } from "effect"
import { Command } from "effect/cli"

import * as Database from "../Database.ts"
import * as Output from "../Output.ts"
import * as Query from "../Query.ts"
import { commonFlags } from "./commonFlags.ts"

export const runs = Command.make(
  "runs",
  commonFlags,
  Effect.fnUntraced(function* (options) {
    const rows = yield* Query.runs(options)
    yield* Output.runs(rows, options.json)
  }, Effect.provide(Database.layerLocal))
).pipe(Command.withDescription("List executions, newest started first"))
