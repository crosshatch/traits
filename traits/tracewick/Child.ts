import { constants } from "node:os"

import { Effect, pipe, Record, Schema as S } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

// Effect 4's Node spawner exposes signal exits as PlatformError causes rather than exit codes.
// Keep this version-specific adaptation at the process boundary.
const signalExit = S.Struct({
  message: S.TemplateLiteralParser([
    "Process interrupted due to receipt of signal: '",
    S.Literals(Record.keys(constants.signals)),
    "'"
  ])
})

export const run = Effect.fnUntraced(function* (command: ChildProcess.Command) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const child = yield* spawner.spawn(command)
  const services = yield* Effect.context<never>()
  const runFork = Effect.runForkWith(services)
  const listeners = Record.map({ SIGINT: "SIGINT", SIGTERM: "SIGTERM", SIGHUP: "SIGHUP" } as const, (signal) => () => {
    runFork(child.kill({ killSignal: signal }).pipe(Effect.ignore))
  })
  yield* Effect.acquireRelease(
    Effect.sync(() => {
      for (const [signal, listener] of Record.toEntries(listeners)) process.on(signal, listener)
    }),
    () =>
      Effect.sync(() => {
        for (const [signal, listener] of Record.toEntries(listeners)) process.off(signal, listener)
      })
  )
  return yield* child.exitCode.pipe(
    Effect.map((exitCode) => ({ exitCode, signal: null })),
    Effect.catchTags({
      PlatformError: (error) =>
        pipe(
          error.reason.cause,
          S.decodeUnknownEffect(signalExit),
          Effect.map((parsed) => ({ exitCode: 128 + constants.signals[parsed.message[1]], signal: parsed.message[1] })),
          Effect.mapError(() => error)
        )
    })
  )
}, Effect.scoped)
