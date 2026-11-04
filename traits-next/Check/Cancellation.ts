import { Effect } from "effect"

/** Waits for cooperative cancellation and releases the listener when the wait ends. */
export const awaitAbort = (signal: AbortSignal | undefined) =>
  signal === undefined
    ? Effect.never
    : Effect.callback<void>((resume) => {
        const abort = () => resume(Effect.void)
        if (signal.aborted) {
          abort()
        } else {
          signal.addEventListener("abort", abort, { once: true })
        }
        return Effect.sync(() => signal.removeEventListener("abort", abort))
      })
