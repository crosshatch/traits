import { Clock, Effect, Equal, FileSystem, Option, Path, pipe, Schedule, Schema as S, String } from "effect"
import { HttpClient, HttpClientRequest } from "effect/http"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

import { Discovery, type Operation, type Query } from "./contracts.ts"
import {
  CollectorHealthTimeout,
  CollectorHttpFailure,
  CollectorIdentityMismatch,
  CollectorInvalidResponse,
  CollectorRequestTimeout,
  CollectorShutdownPending,
  CollectorStartupTimeout
} from "./errors.ts"
import { resolveProject, type CaptureGroup } from "./project.ts"
import { isProcessRunning } from "./signals.ts"
import * as TelemetryState from "./TelemetryState.ts"

export const discover = Effect.fn("Client.discover")(function* (directory: string = ".") {
  const fs = yield* FileSystem.FileSystem
  const group = yield* resolveProject(directory)
  const client = yield* HttpClient.HttpClient
  const discovery = yield* fs
    .readFileString(`${group.state}/collector.json`)
    .pipe(Effect.flatMap(S.decodeUnknownEffect(S.fromJsonString(Discovery))))
  const discoveryFile = `${group.state}/collector.json`
  yield* client.get(`${discovery.endpoint}/health`).pipe(
    Effect.flatMap((response) =>
      response.text.pipe(
        Effect.flatMap(
          Effect.fnUntraced(function* (responseBody) {
            if (response.status >= 400) {
              const data = yield* pipe(
                responseBody,
                S.decodeEffect(S.fromJsonString(S.Json)),
                Effect.orElseSucceed(() => responseBody)
              )
              return yield* CollectorHttpFailure.make({
                endpoint: discovery.endpoint,
                method: "GET",
                path: "/health",
                status: response.status,
                response: data,
                responseBody
              })
            }
            return yield* pipe(
              responseBody,
              S.decodeEffect(S.fromJsonString(Discovery)),
              Effect.mapError((cause) =>
                CollectorInvalidResponse.make({
                  endpoint: discovery.endpoint,
                  method: "GET",
                  path: "/health",
                  status: response.status,
                  responseBody,
                  cause
                })
              )
            )
          })
        )
      )
    ),
    Effect.timeoutOrElse({
      duration: "1 second",
      orElse: () => CollectorHealthTimeout.make({ collector: discovery, discoveryFile, timeoutMs: 1000 })
    }),
    Effect.filterOrFail(
      (health) => health.instance === discovery.instance && health.pid === discovery.pid,
      (observed) => CollectorIdentityMismatch.make({ discoveryFile, expected: discovery, observed })
    )
  )
  return discovery
})

/** Missing discovery/dead processes are normal; live collector defects must not be hidden. */
export const findCollector = Effect.fn("Client.findCollector")(function* (directory: string = ".") {
  const fs = yield* FileSystem.FileSystem
  const group = yield* resolveProject(directory)
  const recorded = yield* fs
    .readFileString(`${group.state}/collector.json`)
    .pipe(
      Effect.flatMap(S.decodeUnknownEffect(S.fromJsonString(Discovery))),
      Effect.catchReasons("PlatformError", { NotFound: () => Effect.undefined })
    )
  if (recorded === undefined) return undefined
  const running = yield* isProcessRunning(recorded.pid)
  if (!running) return undefined
  return yield* discover(directory)
})

export const post = Effect.fn("Client.post")(function* (collector: Discovery, path: string, value: unknown) {
  const client = yield* HttpClient.HttpClient
  const request = yield* HttpClientRequest.bodyJson(HttpClientRequest.post(`${collector.endpoint}${path}`), value)
  return yield* client.execute(request).pipe(
    Effect.flatMap((response) =>
      response.text.pipe(
        Effect.flatMap(
          Effect.fnUntraced(function* (responseBody) {
            if (response.status >= 400) {
              const data = yield* pipe(
                responseBody,
                S.decodeEffect(S.fromJsonString(S.Json)),
                Effect.orElseSucceed(() => responseBody)
              )
              return yield* CollectorHttpFailure.make({
                endpoint: collector.endpoint,
                method: "POST",
                path,
                status: response.status,
                response: data,
                responseBody
              })
            }
            return yield* pipe(
              responseBody,
              S.decodeEffect(S.fromJsonString(S.JsonObject)),
              Effect.mapError((cause) =>
                CollectorInvalidResponse.make({
                  endpoint: collector.endpoint,
                  method: "POST",
                  path,
                  status: response.status,
                  responseBody,
                  cause
                })
              )
            )
          })
        )
      )
    ),
    Effect.timeoutOrElse({
      duration: "5 seconds",
      orElse: () =>
        CollectorRequestTimeout.make({ endpoint: collector.endpoint, method: "POST", path, timeoutMs: 5000 })
    })
  )
})

export const withStartupLock = Effect.fn("Client.withStartupLock")(function* <A, E, R>(
  group: CaptureGroup,
  operation: Effect.Effect<A, E, R>
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const lock = path.join(group.state, "collector.lock")
  if (yield* fs.exists(lock)) {
    const info = yield* fs.stat(lock).pipe(Effect.option, Effect.map(Option.getOrUndefined))
    const now = yield* Clock.currentTimeMillis
    const modified = info === undefined ? undefined : Option.getOrUndefined(info.mtime)
    if (modified !== undefined && now - modified.getTime() > 60_000) {
      yield* fs.remove(lock).pipe(Effect.ignore)
    }
  }
  yield* Effect.acquireRelease(
    fs.open(lock, { flag: "wx" }).pipe(
      Effect.retry({
        schedule: Schedule.spaced("100 millis"),
        times: 100,
        while: (error) => error.reason._tag === "AlreadyExists"
      })
    ),
    () => fs.remove(lock).pipe(Effect.ignore)
  )
  return yield* operation
}, Effect.scoped)

export const ensureCollector = Effect.fn("Client.ensureCollector")(function* (directory: string = ".") {
  const group = yield* resolveProject(directory)
  const existing = yield* findCollector(directory)
  if (existing !== undefined) {
    yield* TelemetryState.inspect(group)
    return existing
  }
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const path = yield* Path.Path
  return yield* withStartupLock(
    group,
    Effect.gen(function* () {
      yield* TelemetryState.inspect(group)
      const existing = yield* findCollector(directory)
      if (existing !== undefined) return existing
      const entry = yield* path.fromFileUrl(
        new URL(pipe(import.meta.url, String.endsWith(".ts")) ? "./cli.ts" : "./cli.js", import.meta.url)
      )
      const daemon = yield* spawner.spawn(
        ChildProcess.make(process.execPath, [entry, "collect", "--managed-startup", "--project", group.worktree], {
          detached: true,
          stdin: "ignore",
          stdout: "ignore",
          stderr: "ignore",
          cwd: group.worktree
        })
      )
      const ready = yield* discover(directory).pipe(
        Effect.retry({ schedule: Schedule.spaced("100 millis"), times: 100 }),
        Effect.timeoutOrElse({
          duration: "15 seconds",
          orElse: () =>
            CollectorStartupTimeout.make({
              directory: group.worktree,
              discoveryFile: `${group.state}/collector.json`,
              logFile: `${group.state}/collector.log`,
              pid: daemon.pid,
              timeoutMs: 15000
            })
        })
      )
      yield* Effect.asVoid(daemon.unref)
      return ready
    })
  )
})

export const query = Effect.fn("Client.query")(function* (
  operation: Operation,
  input: Query = {},
  directory: string = "."
) {
  const collector = yield* ensureCollector(directory)
  return yield* post(collector, "/api/v1/query", { operation, query: input })
})
export const stopCollector = Effect.fn("Client.stopCollector")(function* (directory: string = ".") {
  const collector = yield* findCollector(directory)
  if (collector === undefined) return { stopped: false }
  yield* post(collector, "/api/v1/stop", { instance: collector.instance })
  return { stopped: true }
})

/** Explicit destructive operation; never called by startup or MCP query tools. */
export const resetTelemetryState = Effect.fn("Client.resetTelemetryState")(function* (directory: string = ".") {
  const group = yield* resolveProject(directory)
  return yield* withStartupLock(
    group,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const discoveryFile = `${group.state}/collector.json`
      if (yield* fs.exists(discoveryFile)) {
        const recorded = yield* fs
          .readFileString(discoveryFile)
          .pipe(Effect.flatMap(S.decodeUnknownEffect(S.fromJsonString(Discovery))))
        if (yield* isProcessRunning(recorded.pid)) {
          const live = yield* discover(directory)
          yield* post(live, "/api/v1/stop", { instance: live.instance })
          yield* isProcessRunning(recorded.pid).pipe(
            Effect.filterOrFail(Equal.equals(false), () =>
              CollectorShutdownPending.make({ collector: recorded, directory: group.worktree, timeoutMs: 5000 })
            ),
            Effect.retry({ schedule: Schedule.spaced("100 millis"), times: 50 })
          )
        }
        yield* fs.remove(discoveryFile, { force: true })
      }
      yield* TelemetryState.reset(group)
      return { reset: true, directory: group.worktree }
    })
  )
})
