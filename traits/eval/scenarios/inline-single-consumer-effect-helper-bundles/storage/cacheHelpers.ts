import { Effect, FileSystem, Option, Path } from "effect"

export const makeCacheHelpers = Effect.fn("storage.makeCacheHelpers")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  yield* fs.makeDirectory(directory, { recursive: true }).pipe(Effect.orDie)
  const entry = (key: string) => path.join(directory, `${encodeURIComponent(key)}.cache`)
  return {
    read: (key: string) =>
      fs.readFileString(entry(key)).pipe(
        Effect.map(Option.some),
        Effect.catch(() => Effect.succeed(Option.none<string>()))
      ),
    write: (key: string, text: string) => fs.writeFileString(entry(key), text).pipe(Effect.orDie)
  }
})
