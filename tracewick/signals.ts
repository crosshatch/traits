import { Effect, PlatformError, Predicate } from "effect"
import type { ChildProcess } from "effect/process"

/** Effect's spawner only tracks owned handles; use the OS probe for a detached collector. */
export const isProcessRunning = (pid: number) =>
  Effect.try({
    try: () => {
      process.kill(pid, 0)
      return true
    },
    catch: (cause) => {
      const code = Predicate.isObject(cause) ? cause.code : undefined
      return PlatformError.systemError({
        _tag: code === "ESRCH" ? "NotFound" : code === "EPERM" || code === "EACCES" ? "PermissionDenied" : "Unknown",
        module: "ChildProcess",
        method: "isProcessRunning",
        pathOrDescriptor: pid,
        cause
      })
    }
  }).pipe(Effect.catchReasons("PlatformError", { NotFound: () => Effect.succeed(false) }))

/** NodeRuntime interrupts on signals; retain the original signal for scoped child cleanup. */
export const capture = Effect.acquireRelease(
  Effect.sync(() => {
    let latest: ChildProcess.Signal | undefined
    const interrupt = () => {
      latest = "SIGINT"
    }
    const terminate = () => {
      latest = "SIGTERM"
    }
    process.prependListener("SIGINT", interrupt)
    process.prependListener("SIGTERM", terminate)
    return {
      latest: () => latest,
      release: Effect.sync(() => {
        process.off("SIGINT", interrupt)
        process.off("SIGTERM", terminate)
      })
    }
  }),
  (signals) => signals.release
)
