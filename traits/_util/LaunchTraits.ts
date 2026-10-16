import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect, Logger, Path, pipe, Stdio, String } from "effect"
import { FetchHttpClient } from "effect/http"
import { runCommand } from "tracewick/launcher"

Effect.gen(function* () {
  const path = yield* Path.Path
  const stdio = yield* Stdio.Stdio
  const args = yield* stdio.args
  const main = yield* path.fromFileUrl(
    new URL(pipe(import.meta.url, String.endsWith(".ts")) ? "../main.ts" : "../main.js", import.meta.url)
  )
  const code = yield* runCommand([process.execPath, main, ...args], "traits", path.resolve())
  process.exitCode = code
}).pipe(
  Effect.tapCause(Effect.logError),
  Effect.provide([NodeServices.layer, FetchHttpClient.layer]),
  Effect.provideService(Logger.LogToStderr, true),
  NodeRuntime.runMain({ disableErrorReporting: true })
)
