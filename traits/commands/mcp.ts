import { Effect, Path, pipe, Stdio, String } from "effect"

import * as Run from "../tracewick/Run.ts"

/** Start the MCP server as an instrumented child of the unified CLI. */
export const launch = Effect.gen(function* () {
  const path = yield* Path.Path
  const stdio = yield* Stdio.Stdio
  const args = yield* stdio.args
  const server = path.resolve(
    import.meta.dirname,
    pipe(import.meta.url, String.endsWith(".ts")) ? "../mcp.ts" : "../mcp.js"
  )
  const result = yield* Run.run([process.execPath, server, ...args], false, "traits")
  process.exitCode = result.exitCode
  if (result.signal !== null) process.kill(process.pid, result.signal)
})
