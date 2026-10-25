import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Effect, FileSystem, Path } from "effect"
import { Reactivity } from "effect/reactivity"

import * as Telemetry from "../../reflection/Telemetry.ts"
import { T } from "../../tables/index.ts"
import * as Database from "../../TraitDatabase.ts"
import * as ReflectionClient from "../fixtures/reflectionClient.ts"

it.effect(
  "queries telemetry with SQL joins, JSON extraction and aggregation without model configuration",
  Effect.fnUntraced(
    function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-query-" })
      yield* fs.writeFileString(path.join(directory, "traits.ts"), 'throw new Error("Must not load configuration")')
      const request = yield* ReflectionClient.connect(directory)
      const listed = yield* request("tools/list")
      expect(listed).toMatchObject({ result: { tools: [{ name: "query" }] } })
      expect(listed.result).toHaveProperty("tools.length", 1)
      const empty = yield* ReflectionClient.query(directory, "SELECT * FROM logs")
      expect(empty).toEqual([])
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
      const result = yield* ReflectionClient.query(
        directory,
        "SELECT runs.sectionId, logs.timeUnixNano, json_extract(logs.record, '$.body.stringValue') AS message FROM logs JOIN runs ON logs.runId = runs.id WHERE severityNumber >= 17"
      )
      expect(result).toEqual([{ sectionId: "worker", timeUnixNano: "1792768000123456789", message: "broken" }])
      const count = yield* ReflectionClient.query(directory, "SELECT count(*) AS total FROM logs")
      expect(count).toEqual([{ total: 2 }])
      const invalid = yield* request("tools/call", { name: "query", arguments: { sql: "SELECT missing FROM logs" } })
      expect(invalid).toMatchObject({ result: { isError: true } })
      const ping = yield* request("ping")
      expect(ping).toMatchObject({ result: {} })
    },
    Effect.provide([NodeServices.layer, Reactivity.layer])
  )
)
