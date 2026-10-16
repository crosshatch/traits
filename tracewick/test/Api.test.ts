import { gzipSync } from "node:zlib"

import { layer } from "@effect/vitest"
import { Effect, FileSystem, Layer, pipe, Schema as S } from "effect"
import { HttpClient, HttpClientRequest } from "effect/http"
import { HttpApiClient } from "effect/http-api"
import { expect } from "vite-plus/test"

import { Api } from "../Api.ts"
import { start } from "../collector.ts"
import { EndRun, Query, Run, TelemetryQueryRequest } from "../contracts.ts"
import { resolveProject } from "../project.ts"
import * as Store from "../store.ts"
import { layer as services } from "./Services.ts"

const liveTests = layer(services, { excludeTestServices: true })

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "tracewick-httpapi-" })
  const group = yield* resolveProject(directory)
  const context = yield* Layer.build(Store.layer({ group }))
  const server = yield* start(group).pipe(Effect.provide(context))
  const client = yield* HttpApiClient.make(Api, { baseUrl: server.discovery.endpoint })
  return { client: client.collector, endpoint: server.discovery.endpoint, discovery: server.discovery }
})

liveTests((it) => {
  it.effect("serves schema-defined controls through the generated HttpApi client, including gzipped JSON", () =>
    Effect.gen(function* () {
      const { client, endpoint, discovery } = yield* fixture
      const health = yield* client.health()
      expect(health).toEqual(discovery)
      yield* client.startRun({ payload: Run.make({ id: "api-test", name: "httpapi", command: ["node"], cwd: "." }) })
      const http = yield* HttpClient.HttpClient
      const logged = yield* http.execute(
        HttpClientRequest.post(`${endpoint}/api/v1/log`).pipe(
          HttpClientRequest.setHeader("content-encoding", "gzip"),
          HttpClientRequest.bodyUint8Array(
            gzipSync(JSON.stringify({ runId: "api-test", text: "gzip control", kind: "stderr" })),
            "application/json"
          )
        )
      )
      expect(logged.status).toBe(200)
      yield* client.endRun({ payload: EndRun.make({ runId: "api-test", code: 0, signal: null }) })
      const query = yield* pipe({ runId: "api-test" }, S.decodeEffect(Query))
      const logs = yield* client.query({ payload: TelemetryQueryRequest.make({ operation: "logs", query }) })
      expect(JSON.stringify(logs)).toContain("gzip control")
      const runs = yield* client.query({ payload: TelemetryQueryRequest.make({ operation: "run", query }) })
      expect(JSON.stringify(runs)).toContain('"exitCode":0')
    })
  )

  it.effect("uses HttpApi path and payload validation rather than manual dispatch", () =>
    Effect.gen(function* () {
      const { endpoint } = yield* fixture
      const http = yield* HttpClient.HttpClient
      const invalidPayload = yield* http.execute(
        HttpClientRequest.post(`${endpoint}/api/v1/runs/start`).pipe(
          HttpClientRequest.bodyJsonUnsafe({ id: "missing required fields" })
        )
      )
      expect(invalidPayload.status).toBe(400)
      const invalidRun = yield* http.execute(
        HttpClientRequest.post(`${endpoint}/runs/not-a-run-id/v1/logs`).pipe(HttpClientRequest.bodyJsonUnsafe({}))
      )
      expect(invalidRun.status).toBe(400)
      const unknown = yield* http.get(`${endpoint}/not-an-endpoint`)
      expect(unknown.status).toBe(404)
      const body = yield* unknown.json
      expect(body).toMatchObject({ _tag: "UnknownCollectorRoute", method: "GET" })
      const unsupported = yield* http.execute(
        HttpClientRequest.post(`${endpoint}/v1/logs`).pipe(HttpClientRequest.bodyText("not OTLP"))
      )
      expect(unsupported.status).toBe(415)
    })
  )

  it.effect("preserves run attribution, loopback protection and stop identity validation", () =>
    Effect.gen(function* () {
      const { client, endpoint } = yield* fixture
      const runId = "11111111-1111-4111-8111-111111111111"
      const protobuf = yield* client.runLogs({ params: { runId }, payload: new Uint8Array() })
      expect(pipe(protobuf, S.is(S.Uint8Array))).toBe(true)
      yield* client.runLogs({
        params: { runId },
        payload: { resourceLogs: [{ scopeLogs: [{ logRecords: [{ body: { stringValue: "typed ingest" } }] }] }] }
      })
      const query = yield* pipe({ runId }, S.decodeEffect(Query))
      const logs = yield* client.query({ payload: TelemetryQueryRequest.make({ operation: "logs", query }) })
      expect(JSON.stringify(logs)).toContain("typed ingest")
      const http = yield* HttpClient.HttpClient
      const origin = yield* http.execute(
        HttpClientRequest.get(`${endpoint}/health`).pipe(HttpClientRequest.setHeader("origin", "https://example.com"))
      )
      expect(origin.status).toBe(403)
      const stop = yield* http.execute(
        HttpClientRequest.post(`${endpoint}/api/v1/stop`).pipe(
          HttpClientRequest.bodyJsonUnsafe({ instance: "wrong-instance" })
        )
      )
      expect(stop.status).toBe(409)
      const details = yield* stop.json.pipe(Effect.flatMap(S.decodeUnknownEffect(S.JsonObject)))
      expect(details).toMatchObject({ _tag: "CollectorStopIdentityMismatch", observedInstance: "wrong-instance" })
    })
  )
})
