import { Array, Clock, Effect, FileSystem, Option, Path, String } from "effect"

/** Removes the directory's entries whose names start with the prefix and that are over a minute old, such as what a process leaves behind when it stops in the middle of a write. It never fails, so it can run before the work it tidies up after. */
export const removeStale = Effect.fnUntraced(
  function* (directory: string, prefix: string) {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const now = yield* Clock.currentTimeMillis
    const entries = yield* fs.readDirectory(directory)
    yield* Effect.forEach(
      Array.filter(entries, String.startsWith(prefix)),
      (entry) =>
        Effect.ignore(
          Effect.gen(function* () {
            const stale = path.join(directory, entry)
            const { mtime } = yield* fs.stat(stale)
            // Work under way holds its entry for a moment, so one this old belongs to nothing that is running.
            if (Option.exists(mtime, (modified) => now - modified.getTime() > 60_000)) {
              yield* fs.remove(stale, { recursive: true, force: true })
            }
          })
        ),
      { concurrency: 1, discard: true }
    )
  },
  (effect) => Effect.ignore(effect)
)
