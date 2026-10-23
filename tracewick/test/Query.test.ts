import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Array, Effect, FileSystem, Path, Stream, String } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import { Reactivity } from "effect/reactivity"

import * as Database from "../Database.ts"
import * as Protocol from "../Protocol.ts"
import * as Query from "../Query.ts"
import { T } from "../tables/index.ts"

const traceId = "abcdef0123456789abcdef0123456789"
const spanId = "0123456789abcdef"

it.effect(
  "queries mixed OTLP encodings with correlated IDs, precise fields, and filters before limiting",
  Effect.fnUntraced(
    function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "tracewick-query-" })
      yield* Effect.gen(function* () {
        const db = yield* Database.Database
        yield* db.insert(T.runs).values([
          { id: "a", sectionId: "alpha", command: ["node", "a.ts"], cwd: directory, startedAt: 10 },
          { id: "b", sectionId: "beta", command: ["node", "b.ts"], cwd: directory, startedAt: 20 }
        ])
        const resource = { attributes: [{ key: "service.name", value: { stringValue: "api" } }] }
        const scope = { name: "test", version: "1" }
        for (const encoding of ["json", "protobuf"] as const) {
          const record = {
            traceId: encoding === "json" ? traceId : Buffer.from(traceId, "hex"),
            spanId: encoding === "json" ? spanId : Buffer.from(spanId, "hex"),
            name: "Request timed out",
            startTimeUnixNano: "1792768000123456789",
            endTimeUnixNano: "1792768000123456790",
            status: { code: 2 },
            attributes: [
              { key: "large", value: { intValue: "9223372036854775807" } },
              { key: "bytes", value: { bytesValue: "AP8=" } }
            ],
            links: [
              {
                traceId: encoding === "json" ? traceId : Buffer.from(traceId, "hex"),
                spanId: encoding === "json" ? spanId : Buffer.from(spanId, "hex")
              }
            ]
          }
          const body = {
            resourceSpans: [
              {
                resource,
                schemaUrl: "resource-schema",
                scopeSpans: [
                  { scope, schemaUrl: "scope-schema", spans: [record, { ...record, name: "OK", status: { code: 1 } }] }
                ]
              }
            ]
          }
          const type = Protocol.requests.traces
          yield* db.insert(T.exports).values({
            runId: encoding === "json" ? "a" : "b",
            signal: "traces",
            receivedAt: encoding === "json" ? 100 : 200,
            contentType: encoding === "json" ? "application/json" : "application/x-protobuf",
            payload:
              encoding === "json"
                ? Buffer.from(JSON.stringify(body))
                : Buffer.from(type.encode(type.fromObject(body)).finish())
          })
        }
        const spans = yield* Query.records("traces", {
          errors: true,
          limit: 10,
          search: "TIMED OUT",
          trace: String.toUpperCase(traceId)
        })
        expect(Array.map(spans, (entry) => entry.runId)).toEqual(["b", "a"])
        expect(spans[0]!.record).toEqual(spans[1]!.record)
        expect(spans[0]).toMatchObject({
          resource,
          scope,
          resourceSchemaUrl: "resource-schema",
          scopeSchemaUrl: "scope-schema",
          record: {
            traceId,
            spanId,
            startTimeUnixNano: "1792768000123456789",
            attributes: [
              { key: "large", value: { intValue: "9223372036854775807" } },
              { key: "bytes", value: { bytesValue: "AP8=" } }
            ]
          }
        })
        const section = yield* Query.records("traces", { id: "alpha", errors: false, limit: 1, search: "timed" })
        expect(section).toHaveLength(1)
        expect(section[0]!.runId).toBe("a")
        const recent = yield* Query.records("traces", { run: "a", since: 101, errors: false, limit: 10 })
        expect(recent).toEqual([])
        const older = yield* Query.records("traces", { since: 100, until: 100, errors: true, limit: 10 })
        expect(Array.map(older, (entry) => entry.runId)).toEqual(["a"])
        const byResource = yield* Query.records("traces", {
          run: "b",
          search: "service.name",
          errors: false,
          limit: 10
        })
        expect(byResource).toHaveLength(2)
        const runs = yield* Query.runs({ id: "beta", since: 15, limit: 1 })
        expect(Array.map(runs, (run) => run.id)).toEqual(["b"])

        const logs = {
          resourceLogs: [
            {
              resource,
              scopeLogs: [
                {
                  scope,
                  logRecords: [
                    { traceId, spanId, severityNumber: 17, body: { stringValue: "timeout 100%_literal" } },
                    { traceId, spanId, severityNumber: 13, body: { stringValue: "timeout warning" } }
                  ]
                }
              ]
            }
          ]
        }
        yield* db.insert(T.exports).values({
          runId: "a",
          signal: "logs",
          receivedAt: 300,
          contentType: "application/json",
          payload: Buffer.from(JSON.stringify(logs))
        })
        // A matching record beyond the first page must still be found.
        yield* db.insert(T.exports).values(
          Array.makeBy(105, () => ({
            runId: "a",
            signal: "logs" as const,
            receivedAt: 400,
            contentType: "application/json" as const,
            payload: Buffer.from("{}")
          }))
        )
        const errors = yield* Query.records("logs", {
          id: "alpha",
          trace: traceId,
          errors: true,
          search: "100%_",
          limit: 1
        })
        expect(errors).toHaveLength(1)
        expect(errors[0]!.record.severityNumber).toBe(17)
        const bad = yield* db
          .insert(T.exports)
          .values({
            runId: "b",
            signal: "logs",
            receivedAt: 500,
            contentType: "application/x-protobuf",
            payload: Buffer.from([10, 255])
          })
          .returning({ id: T.exports.id })
        const failure = yield* Query.records("logs", { run: "b", errors: false, limit: 1 }).pipe(Effect.flip)
        expect(failure).toMatchObject({ _tag: "UnreadableExport", exportId: bad[0]!.id })
      }).pipe(Effect.provide(Database.layer(path.join(directory, "tracewick.sqlite"))))
    },
    Effect.provide([NodeServices.layer, Reactivity.layer])
  )
)

it.effect(
  "initializes an empty database and exposes filtered JSON through the CLI",
  Effect.fnUntraced(
    function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "tracewick-query-cli-" })
      const cli = path.resolve(import.meta.dirname, "../main.ts")
      const invoke = Effect.fnUntraced(function* (args: ReadonlyArray<string>) {
        const child = yield* spawner.spawn(ChildProcess.make(process.execPath, [cli, ...args], { cwd: directory }))
        return yield* Effect.all(
          {
            stdout: child.stdout.pipe(Stream.decodeText(), Stream.mkString),
            stderr: child.stderr.pipe(Stream.decodeText(), Stream.mkString),
            code: child.exitCode
          },
          { concurrency: "unbounded" }
        )
      })
      const empty = yield* invoke(["runs", "--json"])
      expect(empty.code, empty.stderr).toBe(0)
      expect(JSON.parse(empty.stdout)).toEqual([])
      const created = yield* fs.exists(path.join(directory, ".tracewick", "tracewick.sqlite"))
      expect(created).toBe(true)
      yield* Effect.gen(function* () {
        const db = yield* Database.Database
        yield* db
          .insert(T.runs)
          .values({ id: "run", sectionId: "worker", command: ["node"], cwd: directory, startedAt: 1 })
        const type = Protocol.requests.logs
        const payload = type
          .encode(
            type.fromObject({
              resourceLogs: [
                {
                  scopeLogs: [
                    {
                      logRecords: [
                        {
                          traceId: Buffer.from(traceId, "hex"),
                          severityNumber: 21,
                          body: { stringValue: "Broken connection" }
                        }
                      ]
                    }
                  ]
                }
              ]
            })
          )
          .finish()
        yield* db.insert(T.exports).values({
          runId: "run",
          signal: "logs",
          receivedAt: 1000,
          contentType: "application/x-protobuf",
          payload: Buffer.from(payload)
        })
      }).pipe(Effect.provide(Database.layer(path.join(directory, ".tracewick", "tracewick.sqlite"))))
      const result = yield* invoke([
        "logs",
        "--id",
        "worker",
        "--run",
        "run",
        "--trace",
        traceId,
        "--search",
        "BROKEN",
        "--errors",
        "--since",
        "1970-01-01T00:00:01Z",
        "--limit",
        "1",
        "--json"
      ])
      expect(result.code, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject([
        {
          sectionId: "worker",
          runId: "run",
          record: { traceId, severityNumber: 21, body: { stringValue: "Broken connection" } }
        }
      ])
      const summary = yield* invoke(["logs", "--id", "worker"])
      expect(summary.code, summary.stderr).toBe(0)
      expect(summary.stdout).toContain("SEVERITY\tBODY")
      expect(summary.stdout).toContain("Broken connection")
      const invalid = yield* invoke(["logs", "--limit", "0"])
      expect(invalid.code).toBe(1)
    },
    Effect.provide([NodeServices.layer, Reactivity.layer])
  )
)
