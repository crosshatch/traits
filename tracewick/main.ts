#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node"
import { Cause, Console, Effect, Logger } from "effect"
import { Command } from "effect/cli"
import { Reactivity } from "effect/reactivity"

import { logs } from "./commands/logs.ts"
import { run } from "./commands/run.ts"
import { runs } from "./commands/runs.ts"
import { traces } from "./commands/traces.ts"
import PackageJson from "./package.json" with { type: "json" }

const program = Command.make("tracewick").pipe(
  Command.withSubcommands([run, runs, traces, logs]),
  Command.run({ version: PackageJson.version }),
  Effect.provide([NodeServices.layer, Reactivity.layer, Logger.layer([Logger.withConsoleError(Logger.formatSimple)])]),
  Effect.catchCause(
    Effect.fnUntraced(function* (cause) {
      yield* Console.error(Cause.pretty(cause))
      process.exitCode = 1
    })
  )
)

// The child owns shutdown: keep its receiver alive while signal handlers flush telemetry.
// NodeRuntime.runMain would interrupt the receiver immediately on SIGINT/SIGTERM.
await Effect.runPromise(program)
