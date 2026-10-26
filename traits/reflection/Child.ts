import { constants } from "node:os"

import { Context, Effect, pipe, Record, Ref, Schema as S } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

export type Result = { readonly exitCode: number; readonly signal: keyof typeof constants.signals | null }

/** The completed child status is shared with run recording and CLI teardown. */
export class ExitStatus extends Context.Service<ExitStatus, Ref.Ref<Result | undefined>>()(
  "traits/reflection/Child/ExitStatus"
) {}

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
  const status = yield* ExitStatus
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
  const awaitExit = child.exitCode.pipe(
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
  // On interruption, keep the collector and signal listeners alive until the child finishes flushing.
  return yield* awaitExit.pipe(
    Effect.onExit(() =>
      awaitExit.pipe(
        Effect.flatMap((result) => Ref.set(status, result)),
        Effect.ignore
      )
    )
  )
}, Effect.scoped)
