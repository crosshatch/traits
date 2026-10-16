import {
  Array,
  Cause,
  Crypto,
  Effect,
  Exit,
  Fiber,
  Formatter,
  Path,
  pipe,
  Queue,
  Ref,
  Schema as S,
  Stdio,
  Stream
} from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

import { ensureCollector, post } from "./client.ts"
import { EndRun, LocalLog, Run } from "./contracts.ts"
import { diagnostic } from "./Diagnostic.ts"
import { CommandRequired } from "./errors.ts"
import * as Signals from "./signals.ts"

export const runCommand = Effect.fn("Launcher.runCommand")(function* (
  command: ReadonlyArray<string>,
  name: string | undefined,
  directory: string
) {
  const executable = command[0]
  if (executable === undefined || executable === "") return yield* CommandRequired.make({ command, directory })
  const collector = yield* ensureCollector(directory)
  const stdio = yield* Stdio.Stdio
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const path = yield* Path.Path
  const crypto = yield* Crypto.Crypto
  const runId = yield* crypto.randomUUIDv4
  yield* post(
    collector,
    "/api/v1/runs/start",
    Run.make({ id: runId, name: name ?? executable, command, cwd: path.resolve() })
  )
  const endpoint = `${collector.endpoint}/runs/${runId}`
  return yield* Effect.gen(function* () {
    const signals = yield* Signals.capture
    const exitCode = yield* Ref.make<number | null>(null)
    yield* Effect.addFinalizer(
      Effect.fn("Launcher.recordExit")(function* (exit) {
        const code = yield* Ref.get(exitCode)
        const signal = signals.latest()
        yield* post(collector, "/api/v1/runs/end", EndRun.make({ runId, code, signal: signal ?? null })).pipe(
          Effect.ignore
        )
        if (Exit.isFailure(exit)) {
          const details = yield* pipe(
            {
              errors: Array.map(Array.filter(exit.cause.reasons, Cause.isFailReason), (reason) =>
                diagnostic(reason.error)
              ),
              defects: Array.map(Array.filter(exit.cause.reasons, Cause.isDieReason), (reason) =>
                diagnostic(reason.defect)
              ),
              interrupted: Cause.hasInterruptsOnly(exit.cause)
            },
            Formatter.formatJson,
            S.decodeEffect(S.fromJsonString(S.JsonObject)),
            Effect.orDie
          )
          yield* post(
            collector,
            "/api/v1/log",
            LocalLog.make({
              runId,
              text: Cause.pretty(exit.cause),
              kind: "process",
              details
            })
          ).pipe(Effect.ignore)
        }
      })
    )
    const queue = yield* Queue.dropping<Uint8Array, Cause.Done>(128)
    const dropped = yield* Ref.make(0)
    const writeLog = (text: string, kind: "stderr" | "process" = "stderr", details?: S.JsonObject) =>
      post(
        collector,
        "/api/v1/log",
        LocalLog.make({ runId, text, kind, ...(details === undefined ? {} : { details }) })
      ).pipe(Effect.catch(() => Ref.update(dropped, (count) => count + new TextEncoder().encode(text).byteLength)))
    const capture = yield* Stream.fromQueue(queue).pipe(
      Stream.decodeText(),
      Stream.flatMap((text) =>
        Stream.fromIterable(
          Array.map(Array.chunksOf(Array.fromIterable(text), 8192), (characters) => Array.join(characters, ""))
        )
      ),
      Stream.runForEach(writeLog),
      Effect.forkScoped
    )
    const child = yield* spawner
      .spawn(
        ChildProcess.make(executable, Array.drop(command, 1), {
          stdin: "inherit",
          stdout: "inherit",
          stderr: "pipe",
          extendEnv: true,
          env: {
            TRACEWICK_RUN_ID: runId,
            OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
            OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: `${endpoint}/v1/traces`,
            OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: `${endpoint}/v1/logs`,
            OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: "http/protobuf",
            OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: "http/protobuf"
          }
        })
      )
      .pipe(
        Effect.tapError((error) =>
          pipe(
            diagnostic(error),
            Formatter.formatJson,
            S.decodeEffect(S.fromJsonString(S.JsonObject)),
            Effect.orDie,
            Effect.flatMap((details) => writeLog(`Unable to launch: ${error.message}`, "process", details))
          )
        )
      )
    const forwarding = yield* child.stderr.pipe(
      Stream.tap((bytes) =>
        Queue.offer(queue, bytes).pipe(
          Effect.flatMap((accepted) =>
            accepted ? Effect.void : Ref.update(dropped, (count) => count + bytes.byteLength)
          )
        )
      ),
      Stream.run(stdio.stderr()),
      Effect.forkScoped
    )
    yield* Effect.addFinalizer(
      Effect.fn("Launcher.finalize")(function* () {
        const signal = signals.latest()
        const running = yield* child.isRunning.pipe(Effect.orElseSucceed(() => false))
        if (running)
          yield* child.kill({ killSignal: signal ?? "SIGTERM", forceKillAfter: "2 seconds" }).pipe(Effect.ignore)
        yield* Fiber.join(forwarding).pipe(Effect.timeout("2 seconds"), Effect.ignore)
        yield* Queue.end(queue)
        yield* Fiber.join(capture).pipe(Effect.timeout("2 seconds"), Effect.ignore)
      })
    )
    const result = yield* child.exitCode.pipe(Effect.exit)
    yield* Fiber.join(forwarding)
    yield* Queue.end(queue)
    yield* Fiber.join(capture).pipe(Effect.timeout("2 seconds"), Effect.ignore)
    const lost = yield* Ref.get(dropped)
    if (lost > 0) {
      const message = `${lost} stderr bytes were not captured (queue overflow or collector failure)`
      yield* writeLog(message, "process")
      yield* Stream.make(`tracewick: ${message}\n`).pipe(Stream.run(stdio.stderr()))
    }
    const code = Exit.isSuccess(result) ? Number(result.value) : null
    yield* Ref.set(exitCode, code)
    yield* writeLog(`Process exited: code=${code}`, "process")
    if (Exit.isFailure(result)) return yield* Effect.failCause(result.cause)
    return code ?? 1
  }).pipe(Effect.scoped)
})
