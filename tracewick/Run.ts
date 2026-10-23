import { eq } from "drizzle-orm"
import { type Array, Clock, Config, Crypto, Effect, Path } from "effect"
import { Hex } from "effect/encoding"
import { ChildProcess } from "effect/process"

import * as Child from "./Child.ts"
import * as Database from "./Database.ts"
import * as ProjectPaths from "./ProjectPaths.ts"
import * as Server from "./Server.ts"
import { T } from "./tables/index.ts"

export const run = Effect.fnUntraced(function* (
  command: Array.NonEmptyReadonlyArray<string>,
  shell: boolean,
  sectionId: string
) {
  const path = yield* Path.Path
  const { cwd, database } = yield* ProjectPaths.resolve
  const crypto = yield* Crypto.Crypto
  const runId = yield* crypto.randomBytes(16).pipe(Effect.map(Hex.encode))
  return yield* Effect.gen(function* () {
    const db = yield* Database.Database
    const startedAt = yield* Clock.currentTimeMillis
    yield* db.insert(T.runs).values({ id: runId, sectionId, command, shell, cwd, startedAt })
    yield* Effect.addFinalizer(
      Effect.fnUntraced(function* () {
        const endedAt = yield* Clock.currentTimeMillis
        yield* db.update(T.runs).set({ endedAt }).where(eq(T.runs.id, runId)).pipe(Effect.orDie)
      })
    )
    const endpoint = yield* Server.start(runId)
    const [executable, ...args] = command
    const serviceName = yield* Config.String("OTEL_SERVICE_NAME").pipe(
      Config.withDefault(shell ? "tracewick-child" : path.basename(executable))
    )
    const result = yield* Child.run(
      ChildProcess.make(executable, args, {
        shell,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
        extendEnv: true,
        env: {
          OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
          OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: `${endpoint}/v1/logs`,
          OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: "http/protobuf",
          OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
          OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: `${endpoint}/v1/traces`,
          OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: "http/protobuf",
          OTEL_LOGS_EXPORTER: "otlp",
          OTEL_SERVICE_NAME: serviceName,
          OTEL_TRACES_EXPORTER: "otlp"
        }
      })
    )
    yield* db.update(T.runs).set(result).where(eq(T.runs.id, runId))
    return result
  }).pipe(Effect.scoped, Effect.provide(Database.layer(database)))
}, Effect.scoped)
