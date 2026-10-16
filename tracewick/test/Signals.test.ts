import { effect } from "@effect/vitest"
import { Effect, PlatformError } from "effect"
import { expect, vi } from "vite-plus/test"

import { isProcessRunning } from "../signals.ts"

effect("defers PID probing until the returned Effect executes", () =>
  Effect.gen(function* () {
    const spy = yield* Effect.acquireRelease(
      Effect.sync(() => vi.spyOn(process, "kill").mockReturnValue(true)),
      (mock) => Effect.sync(() => mock.mockRestore())
    )
    const probe = isProcessRunning(123)
    expect(spy).not.toHaveBeenCalled()
    const running = yield* probe
    expect(running).toBe(true)
    expect(spy).toHaveBeenCalledWith(123, 0)
  })
)

effect("recognizes the current process", () =>
  Effect.gen(function* () {
    const running = yield* isProcessRunning(process.pid)
    expect(running).toBe(true)
  })
)

effect.each(["ESRCH", "EPERM", "EACCES", "EUNKNOWN"])(
  "classifies process probe failure %s without swallowing unexpected errors",
  (code) =>
    Effect.gen(function* () {
      const cause = Object.assign(new Error("probe failed"), { code })
      yield* Effect.acquireRelease(
        Effect.sync(() =>
          vi.spyOn(process, "kill").mockImplementation(() => {
            throw cause
          })
        ),
        (spy) => Effect.sync(() => spy.mockRestore())
      )
      if (code === "ESRCH") {
        const running = yield* isProcessRunning(123)
        expect(running).toBe(false)
      } else {
        const error = yield* isProcessRunning(123).pipe(Effect.flip)
        expect(error).toBeInstanceOf(PlatformError.PlatformError)
        expect(error.reason._tag).toBe(code === "EUNKNOWN" ? "Unknown" : "PermissionDenied")
        expect(error.reason.cause).toBe(cause)
      }
    })
)
