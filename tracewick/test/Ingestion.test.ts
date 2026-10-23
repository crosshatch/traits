import { gzipSync } from "node:zlib"

import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { ProtobufLogsSerializer, ProtobufTraceSerializer } from "@opentelemetry/otlp-transformer"
import { Array, Effect, FileSystem, Path, Stream } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import { Reactivity } from "effect/reactivity"

import * as Database from "../Database.ts"
import * as Protocol from "../Protocol.ts"
import * as Server from "../Server.ts"
import { T } from "../tables/index.ts"

it.effect(
  "commits lossless JSON, protobuf and gzip batches, rejecting malformed requests",
  Effect.fnUntraced(
    function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "tracewick-" })
      yield* Effect.gen(function* () {
        const db = yield* Database.Database
        yield* db.insert(T.runs).values({ id: "run", command: ["fixture"], cwd: directory, startedAt: 1 })
        const endpoint = yield* Server.start("run")
        const client = yield* HttpClient.HttpClient
        const post = Effect.fnUntraced(function* (
          signal: Protocol.Signal,
          contentType: string,
          payload: Uint8Array,
          gzip: boolean = false
        ) {
          return yield* client.execute(
            HttpClientRequest.post(`${endpoint}/v1/${signal}`).pipe(
              HttpClientRequest.bodyUint8Array(gzip ? gzipSync(payload) : payload, contentType),
              HttpClientRequest.setHeader("content-encoding", gzip ? "gzip" : "identity")
            )
          )
        })
        const json = Buffer.from(
          JSON.stringify({
            resourceSpans: [
              {
                scopeSpans: [
                  {
                    spans: [
                      {
                        traceId: "0123456789abcdef0123456789abcdef",
                        spanId: "0123456789abcdef",
                        name: "precise",
                        startTimeUnixNano: "1792768000123456789",
                        endTimeUnixNano: "1792768000123456790",
                        attributes: [{ key: "integer", value: { intValue: "9223372036854775807" } }],
                        futureField: "preserved"
                      }
                    ]
                  }
                ]
              }
            ]
          })
        )
        const response = yield* post("traces", "application/json; charset=utf-8", json, true)
        expect(response.status).toBe(200)
        const responseText = yield* response.text
        expect(responseText).toBe("{}")
        for (const signal of ["traces", "logs"] as const) {
          const serializer = signal === "traces" ? ProtobufTraceSerializer : ProtobufLogsSerializer
          const payload = serializer.serializeRequest([])!
          const response = yield* post(signal, "application/x-protobuf", payload)
          expect(response.status).toBe(200)
          const bytes = yield* response.arrayBuffer
          expect(serializer.deserializeResponse(new Uint8Array(bytes))).toEqual({})
        }
        const invalidJson = yield* post("logs", "application/json", Buffer.from("[]"))
        const invalidProtobuf = yield* post("traces", "application/x-protobuf", Buffer.from([10, 255]))
        const unsupported = yield* post("logs", "text/plain", Buffer.from("{}"))
        expect(invalidJson.status).toBe(400)
        expect(invalidProtobuf.status).toBe(400)
        expect(unsupported.status).toBe(415)
        const rows = yield* db.select().from(T.exports)
        expect(rows).toHaveLength(3)
        expect(Buffer.from(rows[0]!.payload)).toEqual(json)
      }).pipe(Effect.provide(Database.layer(path.join(directory, "tracewick.sqlite"))))
    },
    Effect.provide([NodeServices.layer, Reactivity.layer, FetchHttpClient.layer])
  )
)

it.effect(
  "runs real Effect exporters in both encodings and preserves shell/argv/stdio/exit behavior",
  Effect.fnUntraced(
    function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "tracewick-" })
      const cli = path.resolve(import.meta.dirname, "../main.ts")
      const fixture = path.resolve(import.meta.dirname, "fixtures/telemetry.ts")
      for (const encoding of ["json", "protobuf"]) {
        const child = yield* spawner.spawn(
          ChildProcess.make(
            process.execPath,
            [cli, "run", "--id", "telemetry", "--", process.execPath, fixture, encoding],
            {
              cwd: directory
            }
          )
        )
        const [stdout, stderr, exitCode] = yield* Effect.all(
          [
            child.stdout.pipe(Stream.decodeText(), Stream.mkString),
            child.stderr.pipe(Stream.decodeText(), Stream.mkString),
            child.exitCode
          ],
          { concurrency: "unbounded" }
        )
        expect(exitCode, stderr).toBe(0)
        expect(stdout).toBe("child stdout\n")
        expect(stderr).toBe("child stderr\n")
      }
      const shell = yield* spawner.spawn(
        ChildProcess.make(process.execPath, [cli, "run", "--id", "pipeline", "cat | tr a-z A-Z; exit 23"], {
          cwd: directory,
          stdin: Stream.make(Buffer.from("hello\n"))
        })
      )
      const [stdout, exitCode] = yield* Effect.all(
        [shell.stdout.pipe(Stream.decodeText(), Stream.mkString), shell.exitCode],
        { concurrency: "unbounded" }
      )
      expect(stdout).toBe("HELLO\n")
      expect(exitCode).toBe(23)
      yield* Effect.gen(function* () {
        const db = yield* Database.Database
        const runs = yield* db.select().from(T.runs)
        expect(Array.map(runs, (run) => run.exitCode)).toEqual([0, 0, 23])
        expect(Array.map(runs, (run) => run.sectionId)).toEqual(["telemetry", "telemetry", "pipeline"])
        const exports = yield* db.select().from(T.exports)
        expect(exports).toHaveLength(4)
        expect(exports).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ signal: "logs", contentType: "application/json" }),
            expect.objectContaining({ signal: "traces", contentType: "application/json" }),
            expect.objectContaining({ signal: "logs", contentType: "application/x-protobuf" }),
            expect.objectContaining({ signal: "traces", contentType: "application/x-protobuf" })
          ])
        )
        for (const row of exports) {
          if (row.contentType === "application/json") {
            expect(Buffer.from(row.payload).toString()).toContain(
              row.signal === "logs" ? "fixture log" : "fixture span"
            )
          } else {
            const type = Protocol.requests[row.signal]
            const decoded = type.toObject(type.decode(row.payload), { longs: String })
            expect(JSON.stringify(decoded)).toContain(row.signal === "logs" ? "fixture log" : "fixture span")
          }
        }
      }).pipe(Effect.provide(Database.layer(path.join(directory, ".tracewick", "tracewick.sqlite"))))
    },
    Effect.provide([NodeServices.layer, Reactivity.layer, FetchHttpClient.layer])
  )
)
