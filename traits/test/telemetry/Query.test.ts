import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Effect, FileSystem, Path, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import { Reactivity } from "effect/reactivity"

import * as Telemetry from "../../reflection/Telemetry.ts"
import { T } from "../../tables/index.ts"
import * as Database from "../../TraitDatabase.ts"

it.effect(
  "queries telemetry with SQL joins, JSON extraction and aggregation without model configuration",
  Effect.fnUntraced(
    function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-query-" })
      yield* fs.writeFileString(path.join(directory, "traits.ts"), 'throw new Error("Must not load configuration")')
      const cli = path.resolve(import.meta.dirname, "../../bin.ts")
      const invoke = Effect.fnUntraced(function* (sql: string) {
        const child = yield* spawner.spawn(ChildProcess.make(process.execPath, [cli, "query", sql], { cwd: directory }))
        return yield* Effect.all(
          {
            stdout: child.stdout.pipe(Stream.decodeText(), Stream.mkString),
            stderr: child.stderr.pipe(Stream.decodeText(), Stream.mkString),
            code: child.exitCode
          },
          { concurrency: "unbounded" }
        )
      })
      const empty = yield* invoke("SELECT * FROM logs")
      expect(empty.code, empty.stderr).toBe(0)
      expect(JSON.parse(empty.stdout)).toEqual([])
      yield* Effect.gen(function* () {
        const db = yield* Database.TraitDatabase
        yield* db
          .insert(T.runs)
          .values({ id: "run", sectionId: "worker", command: ["node"], cwd: directory, startedAt: 1 })
        yield* Telemetry.ingest("logs", "run", 1000, {
          resourceLogs: [
            {
              resource: { attributes: [] },
              scopeLogs: [
                {
                  logRecords: [
                    { severityNumber: 17, timeUnixNano: "1792768000123456789", body: { stringValue: "broken" } },
                    { severityNumber: 9, body: { stringValue: "ok" } }
                  ]
                }
              ]
            }
          ]
        })
      }).pipe(Effect.provide(Database.layerFile(path.join(directory, ".reflection", "reflection.sqlite"))))
      const result = yield* invoke(
        "SELECT runs.sectionId, logs.timeUnixNano, json_extract(logs.record, '$.body.stringValue') AS message FROM logs JOIN runs ON logs.runId = runs.id WHERE severityNumber >= 17"
      )
      expect(result.code, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual([
        { sectionId: "worker", timeUnixNano: "1792768000123456789", message: "broken" }
      ])
      const count = yield* invoke("SELECT count(*) AS total FROM logs")
      expect(JSON.parse(count.stdout)).toEqual([{ total: 2 }])
      const invalid = yield* invoke("SELECT missing FROM logs")
      expect(invalid.code).toBe(1)
    },
    Effect.provide([NodeServices.layer, Reactivity.layer])
  )
)
