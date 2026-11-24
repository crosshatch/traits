import { Effect, FileSystem, Schedule } from "effect"

/** Moves a file to another path on the same file system in one step, replacing a file that is there. */
export const moveFile = Effect.fnUntraced(function* (from: string, to: string) {
  const fs = yield* FileSystem.FileSystem
  yield* fs.rename(from, to).pipe(
    // Windows refuses to replace a file while another process has it open, which a reader does only briefly.
    Effect.retry({
      schedule: Schedule.spaced("20 millis"),
      times: 5,
      while: (error) => error.reason._tag === "Busy" || error.reason._tag === "PermissionDenied"
    })
  )
})
