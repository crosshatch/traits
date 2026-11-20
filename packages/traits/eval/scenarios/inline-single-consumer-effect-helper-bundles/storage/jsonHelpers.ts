import { Effect, FileSystem, Option, Path } from "effect"

export const makeJsonHelpers = Effect.fn("storage.makeJsonHelpers")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  yield* fs.makeDirectory(directory, { recursive: true }).pipe(Effect.orDie)
  const file = (name: string) => path.join(directory, `${name}.json`)
  return {
    readJson: (name: string) =>
      fs.readFileString(file(name)).pipe(
        Effect.map((text): Option.Option<unknown> => Option.some(JSON.parse(text))),
        Effect.catch(() => Effect.succeed(Option.none<unknown>()))
      ),
    writeJson: (name: string, value: unknown) =>
      fs.writeFileString(file(name), JSON.stringify(value, null, 2)).pipe(Effect.orDie)
  }
})
