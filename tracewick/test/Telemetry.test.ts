import { gzipSync } from "node:zlib"

import { layer } from "@effect/vitest"
import { Array, Context, Effect, FileSystem, Layer, pipe, Queue, Schema as S, Stream, String } from "effect"
import { Hex } from "effect/encoding"
import { HttpClient, HttpClientRequest } from "effect/http"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import protobuf from "protobufjs"
import { expect } from "vite-plus/test"

import { ensureCollector, query, stopCollector } from "../client.ts"
import { start } from "../collector.ts"
import { TelemetryQueryRequest } from "../contracts.ts"
import { resolveProject } from "../project.ts"
import * as Store from "../store.ts"
import { layer as services } from "./Services.ts"

const liveTests = layer(services, { excludeTestServices: true })

liveTests((it) => {
  it.effect("rejects non-JSON log bodies without losing valid records", () =>
    Effect.gen(function* () {
      const { store } = yield* fixture
      const rejected = yield* store.ingest(
        "logs",
        {
          resourceLogs: [
            { scopeLogs: [{ logRecords: [{ body: { stringValue: "valid JSON" } }, { body: { invalid: 1n } }] }] }
          ]
        },
        null
      )
      expect(rejected).toBe(1)
      const logs = yield* store.query("logs", { includeData: true })
      expect(logs.items).toHaveLength(1)
      expect(JSON.stringify(logs)).toContain("valid JSON")
    })
  )

  it.effect("keeps byte-budget pagination resumable without skipping rows", () =>
    Effect.gen(function* () {
      const { store } = yield* fixture
      const text = pipe("λ", String.repeat(30000))
      for (let index = 0; index < 6; index++) {
        yield* store.log({ runId: "byte-budget", text: `${index}:${text}`, kind: "stderr" })
      }
      const first = yield* store.query("logs", { runId: "byte-budget", includeData: true, limit: 100 })
      expect(first.items).toHaveLength(4)
      expect(first.truncated).toBe(true)
      expect(new TextEncoder().encode(JSON.stringify(first)).byteLength).toBeLessThanOrEqual(256 * 1024)
      const second = yield* store.query("logs", {
        runId: "byte-budget",
        includeData: true,
        limit: 100,
        cursor: globalThis.String(first.nextCursor)
      })
      expect(second.items).toHaveLength(2)
      expect(second.nextCursor).toBeNull()
      const firstRows = yield* pipe(first.items, S.decodeUnknownEffect(S.Array(S.Struct({ seq: S.Int }))))
      const secondRows = yield* pipe(second.items, S.decodeUnknownEffect(S.Array(S.Struct({ seq: S.Int }))))
      const sequences = Array.map([...firstRows, ...secondRows], (row) => row.seq)
      expect(Array.dedupe(sequences)).toHaveLength(6)
    })
  )

  it.effect("always advances past an oversized first row and handles empty pages", () =>
    Effect.gen(function* () {
      const { store } = yield* fixture
      const empty = yield* store.query("runs", {})
      expect(empty).toEqual({ items: [], nextCursor: null, truncated: false })
      yield* store.startRun({ id: "small", name: "pagination", command: ["node"], cwd: "." })
      yield* store.startRun({ id: "large", name: "pagination", command: [pipe("x", String.repeat(300000))], cwd: "." })
      const first = yield* store.query("runs", { name: "pagination", limit: 100 })
      expect(first.items).toHaveLength(1)
      expect(first.truncated).toBe(true)
      const second = yield* store.query("runs", {
        name: "pagination",
        limit: 100,
        cursor: globalThis.String(first.nextCursor)
      })
      expect(second.items).toHaveLength(1)
      expect(JSON.stringify(second)).toContain("small")
      expect(second.nextCursor).toBeNull()
    })
  )

  it.effect("coordinates simultaneous first startup and forwards binary stdin without interpretation", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({
        directory: "/tmp/opencode",
        prefix: "tracewick-concurrent-"
      })
      yield* Effect.addFinalizer(() => stopCollector(directory).pipe(Effect.ignore))
      const attempts = [ensureCollector(directory), ensureCollector(directory), ensureCollector(directory)] as const
      const collectors = yield* Effect.all(attempts, { concurrency: "unbounded" })
      expect(collectors[0].instance).toBe(collectors[1].instance)
      expect(collectors[1].instance).toBe(collectors[2].instance)
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const input = new Uint8Array([0, 1, 255, 13, 10])
      const child = yield* spawner.spawn(
        ChildProcess.make(
          process.execPath,
          [
            new URL("../cli.ts", import.meta.url).pathname,
            "--project",
            directory,
            "--",
            process.execPath,
            "-e",
            'process.stdin.on("data", bytes => process.stdout.write(bytes))'
          ],
          { stdin: Stream.make(input) }
        )
      )
      const effects = [Stream.runCollect(child.stdout), Stream.runDrain(child.stderr), child.exitCode] as const
      const outputs = yield* Effect.all(effects, { concurrency: "unbounded" })
      expect(Array.flatMap(outputs[0], Array.fromIterable)).toEqual(Array.fromIterable(input))
      expect(Number(outputs[2])).toBe(0)
    })
  )

  it.effect("forwards interruption to its owned child and persists shutdown evidence", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "tracewick-signal-" })
      yield* Effect.addFinalizer(() => stopCollector(directory).pipe(Effect.ignore))
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const child = yield* spawner.spawn(
        ChildProcess.make(
          process.execPath,
          [
            new URL("../cli.ts", import.meta.url).pathname,
            "--project",
            directory,
            "--run",
            "interrupt",
            "--",
            process.execPath,
            "-e",
            'process.on("SIGINT", () => { console.error("received SIGINT"); process.exit(0) }); setInterval(() => {}, 10000); console.log("ready")'
          ],
          { forceKillAfter: "5 seconds" }
        )
      )
      yield* child.stderr.pipe(Stream.runDrain, Effect.forkScoped)
      const ready = yield* child.stdout.pipe(Stream.decodeText(), Stream.splitLines, Stream.take(1), Stream.runCollect)
      expect(ready).toEqual(["ready"])
      yield* child.kill({ killSignal: "SIGINT", forceKillAfter: "5 seconds" })
      const runs = yield* query("runs", { name: "interrupt" }, directory)
      const logs = yield* query("logs", {}, directory)
      expect(JSON.stringify(runs)).toContain('"signal":"SIGINT"')
      expect(JSON.stringify(logs)).toContain("received SIGINT")
    }).pipe(Effect.timeout("20 seconds"))
  )
  const fixture = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "tracewick-test-" })
    const group = yield* resolveProject(directory)
    const context = yield* Layer.build(Store.layer({ group }))
    const server = yield* start(group).pipe(Effect.provide(context))
    return { group, server, store: Context.get(context, Store.Store) }
  })
  const traceId = "11111111111111111111111111111111"
  const spanId = "2222222222222222"

  it.effect("bounds decompressed requests and returns errors using the incoming OTLP encoding", () =>
    Effect.gen(function* () {
      const { server } = yield* fixture
      const client = yield* HttpClient.HttpClient
      const oversized = gzipSync(pipe("x", String.repeat(4 * 1024 * 1024 + 1)))
      const response = yield* client.execute(
        HttpClientRequest.post(`${server.discovery.endpoint}/v1/logs`).pipe(
          HttpClientRequest.setHeader("content-encoding", "gzip"),
          HttpClientRequest.bodyUint8Array(oversized, "application/x-protobuf")
        )
      )
      expect(response.status).toBe(413)
      expect(response.headers["content-type"]).toContain("application/x-protobuf")
      const malformed = yield* client.execute(
        HttpClientRequest.post(`${server.discovery.endpoint}/v1/logs`).pipe(
          HttpClientRequest.bodyUint8Array(new Uint8Array([255]), "application/x-protobuf")
        )
      )
      expect(malformed.status).toBe(400)
      expect(malformed.headers["content-type"]).toContain("application/x-protobuf")
    })
  )

  it.effect("attributes exported application telemetry to the unique named run", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "tracewick-export-" })
      yield* Effect.addFinalizer(() => stopCollector(directory).pipe(Effect.ignore))
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const script = `const response = await fetch(process.env.OTEL_EXPORTER_OTLP_ENDPOINT + "/v1/traces", {method: "POST", headers: {"Content-Type":"application/json"}, body: ${JSON.stringify(JSON.stringify(traces))}}); if (!response.ok) throw new Error(await response.text())`
      const code = yield* spawner.exitCode(
        ChildProcess.make(
          process.execPath,
          [
            new URL("../cli.ts", import.meta.url).pathname,
            "--project",
            directory,
            "--run",
            "instrumented",
            "--",
            process.execPath,
            "--input-type=module",
            "-e",
            script
          ],
          { stdout: "ignore", stderr: "ignore" }
        )
      )
      expect(Number(code)).toBe(0)
      const runs = yield* query("runs", { name: "instrumented" }, directory)
      const decoded = yield* pipe(runs, S.decodeUnknownEffect(S.Struct({ items: S.Array(S.Struct({ id: S.String })) })))
      const id = decoded.items[0]?.id
      expect(id).toBeDefined()
      const evidence = yield* query("traces", { runId: globalThis.String(id) }, directory)
      expect(evidence.items).toHaveLength(1)
    })
  )
  const span = {
    traceId,
    spanId,
    name: "broken-operation",
    startTimeUnixNano: "1790000000000000001",
    endTimeUnixNano: "1790000000001000001",
    status: { code: 2 }
  }
  const traces = {
    resourceSpans: [
      {
        resource: { attributes: [{ key: "service.name", value: { stringValue: "fixture" } }] },
        scopeSpans: [{ spans: [span] }]
      }
    ]
  }

  it.effect("ingests gzipped JSON, correlates logs, preserves nanoseconds and deduplicates spans", () =>
    Effect.gen(function* () {
      const { server, store } = yield* fixture
      const client = yield* HttpClient.HttpClient
      const request = HttpClientRequest.post(`${server.discovery.endpoint}/v1/traces`).pipe(
        HttpClientRequest.setHeader("content-encoding", "gzip"),
        HttpClientRequest.bodyUint8Array(gzipSync(JSON.stringify(traces)), "application/json")
      )
      const response = yield* client.execute(request)
      expect(response.status).toBe(200)
      yield* store.ingest("traces", traces, null)
      yield* store.ingest(
        "logs",
        {
          resourceLogs: [
            {
              scopeLogs: [
                {
                  logRecords: [
                    {
                      traceId,
                      spanId,
                      timeUnixNano: "1790000000000000001",
                      severityNumber: 17,
                      body: { stringValue: "root cause" }
                    }
                  ]
                }
              ]
            }
          ]
        },
        null
      )
      const result = yield* store.query("trace", { traceId })
      expect(result.items).toHaveLength(1)
      expect(JSON.stringify(result)).toContain("1790000000000000001")
      const logs = yield* store.query("logs", { traceId, spanId, errors: true })
      expect(JSON.stringify(logs)).toContain("root cause")
    })
  )

  it.effect("accepts OTLP protobuf and rejects malformed records without losing valid ones", () =>
    Effect.gen(function* () {
      const { server, store } = yield* fixture
      const type = protobuf
        .parse(
          `syntax="proto3"; message Log { bytes trace_id=9; bytes span_id=10; fixed64 time_unix_nano=1; string severity_text=3; } message Scope { repeated Log log_records=2; } message Resource { repeated Scope scope_logs=2; } message Request { repeated Resource resource_logs=1; }`
        )
        .root.lookupType("Request")
      const traceBytes = yield* Effect.fromResult(Hex.decode(traceId))
      const spanBytes = yield* Effect.fromResult(Hex.decode(spanId))
      const body = type
        .encode(
          type.fromObject({
            resourceLogs: [
              {
                scopeLogs: [
                  {
                    logRecords: [
                      {
                        traceId: traceBytes,
                        spanId: spanBytes,
                        timeUnixNano: "1790000000000000001",
                        severityText: "ERROR"
                      }
                    ]
                  }
                ]
              }
            ]
          })
        )
        .finish()
      const client = yield* HttpClient.HttpClient
      const response = yield* client.execute(
        HttpClientRequest.post(`${server.discovery.endpoint}/v1/logs`).pipe(
          HttpClientRequest.bodyUint8Array(body, "application/x-protobuf")
        )
      )
      expect(response.status).toBe(200)
      const logs = yield* store.query("logs", { traceId })
      expect(JSON.stringify(logs)).toContain(traceId)
      const rejected = yield* store.ingest(
        "traces",
        { resourceSpans: [{ scopeSpans: [{ spans: [span, { ...span, traceId: "invalid" }] }] }] },
        null
      )
      expect(rejected).toBe(1)
      const status = yield* store.query("status", {})
      expect(JSON.stringify(status)).toContain('"value":1')
    })
  )

  it.effect("paginates grouped traces without repeating a trace and validates query bounds", () =>
    Effect.gen(function* () {
      const { store } = yield* fixture
      for (let index = 1; index <= 3; index++) {
        yield* store.ingest(
          "traces",
          {
            resourceSpans: [
              {
                scopeSpans: [
                  {
                    spans: [
                      {
                        ...span,
                        traceId: pipe(globalThis.String(index), String.repeat(32)),
                        spanId: "3333333333333333"
                      },
                      { ...span, traceId: pipe(globalThis.String(index), String.repeat(32)) }
                    ]
                  }
                ]
              }
            ]
          },
          null
        )
      }
      const first = yield* store.query("traces", { limit: 1 })
      const second = yield* store.query("traces", { limit: 1, cursor: globalThis.String(first.nextCursor) })
      expect(first.items).not.toEqual(second.items)
      const invalid = yield* pipe(
        { operation: "logs" as const, query: { limit: 1000 } },
        S.decodeEffect(TelemetryQueryRequest),
        Effect.isFailure
      )
      expect(invalid).toBe(true)
    })
  )

  it.effect("bounds active data and removes expired records", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({
        directory: "/tmp/opencode",
        prefix: "tracewick-retention-"
      })
      const group = yield* resolveProject(directory)
      const context = yield* Layer.build(
        Store.layer({ group, policy: { retentionHours: 1, maxRecords: 2, maxBytes: 2000 } })
      )
      const store = Context.get(context, Store.Store)
      for (let index = 0; index < 4; index++) yield* store.log({ runId: "test", kind: "stderr", text: "bounded" })
      const result = yield* store.query("logs", {})
      expect(Array.isArray(result.items) ? result.items.length : -1).toBeLessThanOrEqual(2)
      yield* store.ingest("traces", traces, null)
      yield* store.prune
      const remaining = yield* store.query("trace", { traceId })
      expect(remaining.items).toEqual([])
    })
  )

  it.effect("owns arbitrary commands, preserves stdout and nonzero exits, and retains stderr after exit", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "tracewick-launch-" })
      yield* Effect.addFinalizer(() => stopCollector(directory).pipe(Effect.ignore))
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const executable = new URL("../cli.ts", import.meta.url).pathname
      const child = yield* spawner.spawn(
        ChildProcess.make(process.execPath, [
          executable,
          "--project",
          directory,
          "--run",
          "named",
          "--",
          process.execPath,
          "-e",
          'process.stdout.write("untouched\\u0000bytes"); console.error("startup failed"); process.exitCode=7'
        ])
      )
      const outputs = yield* Effect.all(
        [
          Stream.mkString(child.stdout.pipe(Stream.decodeText())),
          Stream.mkString(child.stderr.pipe(Stream.decodeText())),
          child.exitCode
        ],
        { concurrency: "unbounded" }
      )
      expect(outputs[0]).toBe("untouched\u0000bytes")
      expect(outputs[1]).toContain("startup failed")
      expect(Number(outputs[2])).toBe(7)
      const result = yield* query("runs", { name: "named" }, directory)
      expect(JSON.stringify(result)).toContain('"exitCode":7')
      const logs = yield* query("logs", {}, directory)
      expect(JSON.stringify(logs)).toContain("startup failed")
      const connections = [ensureCollector(directory), ensureCollector(directory)] as const
      const collectors = yield* Effect.all(connections, { concurrency: "unbounded" })
      expect(collectors[0].instance).toBe(collectors[1].instance)
    })
  )

  it.effect("records failed executable launches and keeps independent capture groups isolated", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const first = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "tracewick-fail-" })
      const second = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "tracewick-other-" })
      yield* Effect.addFinalizer(() =>
        Effect.all([stopCollector(first), stopCollector(second)], { concurrency: "unbounded" }).pipe(Effect.ignore)
      )
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const child = yield* spawner.spawn(
        ChildProcess.make(process.execPath, [
          new URL("../cli.ts", import.meta.url).pathname,
          "--project",
          first,
          "--run",
          "missing",
          "--",
          "tracewick-no-such-executable"
        ])
      )

      const completion = [Stream.runDrain(child.stdout), Stream.runDrain(child.stderr), child.exitCode] as const
      yield* Effect.all(completion, { concurrency: "unbounded" })
      const firstLogs = yield* query("logs", { includeData: true }, first)
      const secondLogs = yield* query("logs", {}, second)
      expect(JSON.stringify(firstLogs)).toContain("Unable to launch")
      expect(JSON.stringify(firstLogs)).toContain('"_tag":"PlatformError"')
      expect(secondLogs.items).toEqual([])
    })
  )

  it.effect("resolves Git subdirectories and linked worktrees into isolated local capture groups", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const base = yield* fs.makeTempDirectoryScoped({
        directory: "/tmp/opencode",
        prefix: "tracewick-worktree-"
      })
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const git = (args: ReadonlyArray<string>) =>
        spawner.exitCode(ChildProcess.make("git", args, { stdout: "ignore", stderr: "ignore" }))
      const initialized = yield* git(["init", `${base}/main`])
      expect(Number(initialized)).toBe(0)
      const committed = yield* git([
        "-C",
        `${base}/main`,
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.com",
        "commit",
        "--allow-empty",
        "-m",
        "initial"
      ])
      expect(Number(committed)).toBe(0)
      const added = yield* git(["-C", `${base}/main`, "worktree", "add", "--detach", `${base}/linked`])
      expect(Number(added)).toBe(0)
      yield* fs.makeDirectory(`${base}/linked/nested`)
      const main = yield* resolveProject(`${base}/main`)
      const linked = yield* resolveProject(`${base}/linked/nested`)
      expect(main.project).toBe(linked.project)
      expect(main.state).not.toBe(linked.state)
      expect(linked.worktree).toBe(`${base}/linked`)
    })
  )

  it.effect("exposes query tools over an independent MCP connection", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({
        directory: "/tmp/opencode",
        prefix: "tracewick-mcp-"
      })
      yield* Effect.addFinalizer(() => stopCollector(directory).pipe(Effect.ignore))
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const input = yield* Queue.unbounded<Uint8Array>()
      const output = yield* Queue.unbounded<string>()
      const child = yield* spawner.spawn(
        ChildProcess.make(
          process.execPath,
          [new URL("../cli.ts", import.meta.url).pathname, "mcp", "--project", directory],
          { stdin: Stream.fromQueue(input), forceKillAfter: "2 seconds" }
        )
      )
      yield* child.stdout.pipe(
        Stream.decodeText(),
        Stream.splitLines,
        Stream.runForEach((line) => Queue.offer(output, line)),
        Effect.forkScoped
      )
      yield* child.stderr.pipe(Stream.runDrain, Effect.forkScoped)
      const send = (value: unknown) => Queue.offer(input, new TextEncoder().encode(`${JSON.stringify(value)}\n`))
      yield* send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } }
      })
      const initialized = yield* Queue.take(output)
      expect(initialized).toContain('"protocolVersion":"2025-11-25"')
      yield* send({ jsonrpc: "2.0", method: "notifications/initialized" })
      yield* send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })
      const listed = yield* Queue.take(output)
      expect(listed).toContain("otel_search_logs")
      yield* send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "otel_status", arguments: {} } })
      const called = yield* Queue.take(output)
      expect(called).toContain("captureGroup")
      yield* send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "otel_get_trace", arguments: {} } })
      const failed = yield* Queue.take(output)
      const reply = yield* pipe(
        failed,
        S.decodeEffect(
          S.fromJsonString(
            S.Struct({ result: S.Struct({ isError: S.Boolean, content: S.Array(S.Struct({ text: S.String })) }) })
          )
        )
      )
      expect(reply.result.isError).toBe(true)
      const details = yield* pipe(reply.result.content[0]?.text, S.decodeUnknownEffect(S.fromJsonString(S.JsonObject)))
      expect(details).toMatchObject({
        _tag: "CollectorHttpFailure",
        status: 400,
        path: "/api/v1/query",
        response: { _tag: "MissingTraceId", operation: "trace" }
      })
    }).pipe(Effect.timeout("20 seconds"))
  )
})
