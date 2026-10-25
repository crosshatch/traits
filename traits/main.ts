#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node"
import { Cause, Console, Effect, Logger } from "effect"
import { Command } from "effect/cli"
import { Reactivity } from "effect/reactivity"

import * as Mcp from "./commands/mcp.ts"
import { query } from "./commands/query.ts"
import { run } from "./commands/run.ts"
import PackageJson from "./package.json" with { type: "json" }

const program = Command.make("traits").pipe(
  Command.withDescription("Run the Traits MCP server or inspect worktree telemetry"),
  Command.withHandler(() => Mcp.launch),
  Command.withSubcommands([run, query]),
  Command.run({ version: PackageJson.version }),
  Effect.provide([NodeServices.layer, Reactivity.layer, Logger.layer([Logger.withConsoleError(Logger.formatSimple)])]),
  Effect.catchCause(
    Effect.fnUntraced(function* (cause) {
      yield* Console.error(Cause.pretty(cause))
      process.exitCode = 1
    })
  )
)

// Keep the receiver alive while a signalled child flushes its exporters.
await Effect.runPromise(program)
