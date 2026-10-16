import { effect, layer } from "@effect/vitest"
import { Effect, Fiber, FileSystem, Formatter, Layer, pipe, PlatformError, Schema as S, String } from "effect"
import { HttpClient, HttpClientResponse } from "effect/http"
import { TestClock } from "effect/testing"
import { expect } from "vite-plus/test"

import { discover, ensureCollector, post } from "../client.ts"
import { diagnostic } from "../Diagnostic.ts"
import {
  CollectorHttpFailure,
  CollectorIdentityMismatch,
  CollectorInvalidResponse,
  CollectorRequestTimeout,
  InvalidQueryCursor,
  LocalLogTooLarge,
  MissingRunId,
  MissingSpanId,
  MissingTraceId
} from "../errors.ts"
import { resolveProject } from "../project.ts"
import * as Store from "../store.ts"
import { layer as services } from "./Services.ts"

const liveTests = layer(services, { excludeTestServices: true })

effect("retains native filesystem fields and original error causes in diagnostics", () =>
  Effect.gen(function* () {
    const cause = Object.assign(new Error("missing file"), {
      code: "ENOENT",
      path: "/missing/collector.json",
      syscall: "open"
    })
    const error = PlatformError.systemError({
      _tag: "NotFound",
      module: "FileSystem",
      method: "readFileString",
      pathOrDescriptor: cause.path,
      cause
    })
    const wire = yield* pipe(diagnostic(error), Formatter.formatJson, S.decodeEffect(S.fromJsonString(S.JsonObject)))
    expect(wire).toMatchObject({
      _tag: "PlatformError",
      reason: { _tag: "NotFound", pathOrDescriptor: cause.path },
      cause: { code: "ENOENT", path: cause.path, syscall: "open", message: "missing file" }
    })
  })
)

effect("reports request timeout context without waiting on a real clock", () =>
  Effect.gen(function* () {
    const http = HttpClient.make(() => Effect.never)
    const waiting = yield* post(
      { endpoint: "http://127.0.0.1:4318", instance: "test", pid: 1 },
      "/api/v1/query",
      {}
    ).pipe(Effect.provideService(HttpClient.HttpClient, http), Effect.flip, Effect.forkChild)
    yield* TestClock.adjust(5000)
    const failure = yield* Fiber.join(waiting)
    expect(failure).toBeInstanceOf(CollectorRequestTimeout)
    expect(failure).toMatchObject({
      endpoint: "http://127.0.0.1:4318",
      path: "/api/v1/query",
      method: "POST",
      timeoutMs: 5000
    })
  })
)

liveTests((it) => {
  it.effect("retains expected and observed identities and does not mask a live mismatch", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({
        directory: "/tmp/opencode",
        prefix: "tracewick-identity-"
      })
      const group = yield* resolveProject(directory)
      const expected = { endpoint: "http://127.0.0.1:4318", instance: "expected", pid: process.pid }
      const observed = { ...expected, instance: "different" }
      yield* fs.writeFileString(`${group.state}/collector.json`, JSON.stringify(expected))
      const http = HttpClient.make((request) =>
        Effect.succeed(HttpClientResponse.fromWeb(request, new Response(JSON.stringify(observed))))
      )
      const failure = yield* discover(directory).pipe(Effect.provideService(HttpClient.HttpClient, http), Effect.flip)
      expect(failure).toBeInstanceOf(CollectorIdentityMismatch)
      expect(failure).toMatchObject({ expected, observed, discoveryFile: `${group.state}/collector.json` })
      const startupFailure = yield* ensureCollector(directory).pipe(
        Effect.provideService(HttpClient.HttpClient, http),
        Effect.flip
      )
      expect(startupFailure).toBeInstanceOf(CollectorIdentityMismatch)
      const wire = yield* pipe(
        diagnostic(failure),
        Formatter.formatJson,
        S.decodeEffect(S.fromJsonString(S.JsonObject))
      )
      expect(wire).toMatchObject({ _tag: "CollectorIdentityMismatch", expected, observed })
    })
  )

  it.effect("retains HTTP status, request context and non-JSON error bodies", () =>
    Effect.gen(function* () {
      const http = HttpClient.make((request) =>
        Effect.succeed(HttpClientResponse.fromWeb(request, new Response("<html>not ready</html>", { status: 503 })))
      )
      const failure = yield* post(
        { endpoint: "http://127.0.0.1:4318", instance: "test", pid: 1 },
        "/api/v1/query",
        {}
      ).pipe(Effect.provideService(HttpClient.HttpClient, http), Effect.flip)
      expect(failure).toBeInstanceOf(CollectorHttpFailure)
      expect(failure).toMatchObject({
        endpoint: "http://127.0.0.1:4318",
        path: "/api/v1/query",
        method: "POST",
        status: 503,
        responseBody: "<html>not ready</html>",
        response: "<html>not ready</html>"
      })
    })
  )

  it.effect("distinguishes malformed success responses from HTTP failures", () =>
    Effect.gen(function* () {
      const http = HttpClient.make((request) =>
        Effect.succeed(HttpClientResponse.fromWeb(request, new Response("not JSON")))
      )
      const failure = yield* post(
        { endpoint: "http://127.0.0.1:4318", instance: "test", pid: 1 },
        "/api/v1/query",
        {}
      ).pipe(Effect.provideService(HttpClient.HttpClient, http), Effect.flip)
      expect(failure).toBeInstanceOf(CollectorInvalidResponse)
      expect(failure).toMatchObject({ status: 200, responseBody: "not JSON", path: "/api/v1/query" })
      const wire = yield* pipe(
        diagnostic(failure),
        Formatter.formatJson,
        S.decodeEffect(S.fromJsonString(S.JsonObject))
      )
      expect(wire).toHaveProperty("cause")
    })
  )

  it.effect("provides distinct validation errors and record-size metadata", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({
        directory: "/tmp/opencode",
        prefix: "tracewick-validation-"
      })
      const group = yield* resolveProject(directory)
      const context = yield* Layer.build(Store.layer({ group }))
      const store = yield* Store.Store.pipe(Effect.provide(context))
      const run = yield* store.query("run", {}).pipe(Effect.flip)
      const trace = yield* store.query("trace", {}).pipe(Effect.flip)
      const span = yield* store.query("span", { traceId: "test" }).pipe(Effect.flip)
      const cursor = yield* store.query("logs", { cursor: "invalid" }).pipe(Effect.flip)
      expect(run).toBeInstanceOf(MissingRunId)
      expect(trace).toBeInstanceOf(MissingTraceId)
      expect(span).toBeInstanceOf(MissingSpanId)
      expect(cursor).toBeInstanceOf(InvalidQueryCursor)
      expect(cursor).toMatchObject({ operation: "logs", cursor: "invalid" })
      const oversized = yield* store
        .log({ runId: "too-large", kind: "stderr", text: pipe("x", String.repeat(128 * 1024)) })
        .pipe(Effect.flip)
      expect(oversized).toBeInstanceOf(LocalLogTooLarge)
      expect(oversized).toMatchObject({ runId: "too-large", kind: "stderr", maxBytes: 128 * 1024 })
    })
  )
})
