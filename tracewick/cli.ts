#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import {
  Array,
  Cause,
  Console,
  Effect,
  Equal,
  FileSystem,
  Layer,
  Logger,
  Option,
  pipe,
  Schema as S,
  Scope,
  Stdio,
  String
} from "effect"
import { McpProtocol, McpServer } from "effect/ai"
import { Argument, Command, Flag, Prompt } from "effect/cli"
import { FetchHttpClient } from "effect/http"

import { findCollector, query, resetTelemetryState, stopCollector, withStartupLock } from "./client.ts"
import { start } from "./collector.ts"
import { Operation, Query } from "./contracts.ts"
import { CollectorAlreadyRunning, ResetApprovalRequired } from "./errors.ts"
import { runCommand } from "./launcher.ts"
import * as Mcp from "./mcp.ts"
import PackageJson from "./package.json" with { type: "json" }
import { resolveProject } from "./project.ts"
import * as Store from "./store.ts"
import * as TelemetryState from "./TelemetryState.ts"

const root = Command.make("tracewick", {
  command: Argument.String("command").pipe(Argument.variadic()),
  run: Flag.String("run").pipe(
    Flag.optional,
    Flag.withDescription("Human-readable run name; each invocation also has a unique run ID")
  )
}).pipe(
  Command.withSharedFlags({ project: Flag.Directory("project").pipe(Flag.withDefault(".")) }),
  Command.withDescription("Capture local OTEL traces, logs and stderr. Launch any command after --."),
  Command.withHandler((params) =>
    params.command.length === 0
      ? Console.log("Use tracewick --help, or tracewick --run name -- command args...")
      : runCommand(params.command, Option.getOrUndefined(params.run), params.project).pipe(
          Effect.map((code) => {
            process.exitCode = code
          })
        )
  )
)
const collect = Command.make(
  "collect",
  {
    managedStartup: Flag.Boolean("managed-startup").pipe(Flag.withDefault(false), Flag.withHidden),
    maxRecords: Flag.Int("max-records").pipe(Flag.optional),
    maxSizeMb: Flag.Int("max-size-mb").pipe(Flag.optional),
    retentionHours: Flag.Finite("retention-hours").pipe(Flag.optional)
  },
  Effect.fn("Cli.collect")(function* (params) {
    const parent = yield* root
    const group = yield* resolveProject(parent.project)
    const policy = yield* pipe(
      {
        retentionHours: Option.getOrUndefined(params.retentionHours),
        maxRecords: Option.getOrUndefined(params.maxRecords),
        maxBytes: params.maxSizeMb.pipe(
          Option.map((mb) => mb * 1024 * 1024),
          Option.getOrUndefined
        )
      },
      S.decodeEffect(Store.Policy)
    )
    yield* Effect.gen(function* () {
      const scope = yield* Effect.scope
      const startup = Effect.gen(function* () {
        yield* TelemetryState.inspect(group)
        yield* findCollector(group.worktree).pipe(
          Effect.flatMap((existing) =>
            existing === undefined
              ? Effect.void
              : CollectorAlreadyRunning.make({ collector: existing, directory: group.worktree })
          )
        )
        const context = yield* Layer.build(Store.layer({ group, policy }))
        return yield* start(group).pipe(Effect.provide(context))
      }).pipe(Effect.provideService(Scope.Scope, scope))
      const server = yield* params.managedStartup ? startup : withStartupLock(group, startup)
      return yield* server.awaitStop
    }).pipe(
      Effect.scoped,
      Effect.tapCause((cause) =>
        Effect.flatMap(FileSystem.FileSystem, (fs) =>
          fs.writeFileString(`${group.state}/collector.log`, Cause.pretty(cause)).pipe(Effect.ignore)
        )
      )
    )
  })
)
const mcp = Command.make("mcp", {}, () =>
  Effect.flatMap(root, (parent) =>
    McpServer.layerStdio({
      name: "tracewick",
      version: PackageJson.version,
      protocols: [McpProtocol.v2025_11_25],
      instructions: Mcp.instructions
    }).pipe(Layer.provide(Mcp.layer(parent.project).pipe(Layer.provideMerge(McpServer.McpServer.layer))), Layer.launch)
  )
)
const stop = Command.make("stop", {}, () =>
  root.pipe(
    Effect.flatMap((parent) => stopCollector(parent.project)),
    Effect.flatMap((result) => Console.log(JSON.stringify(result)))
  )
)
const reset = Command.make(
  "reset",
  {
    yes: Flag.Boolean("yes").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Explicitly approve deletion of all local telemetry runs, logs and traces")
    )
  },
  Effect.fn("Cli.reset")(function* (params) {
    const parent = yield* root
    const group = yield* resolveProject(parent.project)
    const warning = String.stripMargin(`
    | WARNING: Resetting ${group.state}/telemetry.sqlite will delete all captured runs, logs and traces.
    | The collector will be stopped. This cannot be undone.
    `)
    yield* Console.error(warning)
    if (!params.yes) {
      const stdio = yield* Stdio.Stdio
      yield* stdio.stdinIsTerminal.pipe(
        Effect.filterOrFail(Equal.equals(true), () =>
          ResetApprovalRequired.make({
            directory: group.worktree,
            databasePath: `${group.state}/telemetry.sqlite`,
            confirmationFlag: "--yes"
          })
        )
      )
      const approved = yield* Prompt.Confirm({ message: "Delete the old local telemetry database?", initial: false })
      if (!approved) return yield* Console.log("Cancelled; telemetry state left unchanged")
    }
    const result = yield* resetTelemetryState(group.worktree)
    yield* Console.log(JSON.stringify(result))
  })
).pipe(Command.withDescription("Stop the collector and delete its disposable local database after confirmation"))
const queries = Array.map(Operation.literals, (operation) =>
  Command.make(
    operation,
    {
      query: Flag.String("query").pipe(Flag.withDefault("{}"), Flag.withSchema(S.fromJsonString(Query)))
    },
    (params) =>
      root.pipe(
        Effect.flatMap((parent) => query(operation, params.query, parent.project)),
        Effect.flatMap((result) => Console.log(JSON.stringify(result, null, 2)))
      )
  )
)
root.pipe(
  Command.withSubcommands([collect, mcp, reset, stop, ...queries]),
  Command.run({ version: PackageJson.version }),
  Effect.tapCause(Effect.logError),
  Effect.provide([NodeServices.layer, FetchHttpClient.layer]),
  Effect.provideService(Logger.LogToStderr, true),
  NodeRuntime.runMain({ disableErrorReporting: true })
)
