import { Effect, FileSystem, Path } from "effect"

/**
 * Writes `contents` to a temporary file in `directory`, removed when the scope closes. Staging in
 * the destination directory keeps the later install a same-filesystem link or rename.
 */
export const stage = Effect.fnUntraced(function* (options: {
  readonly directory: string
  readonly filename: string
  readonly contents: string
  readonly mode?: number | undefined
}) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const staging = yield* fs.makeTempDirectoryScoped({ directory: options.directory, prefix: ".traits-write-" })
  const temporary = path.join(staging, options.filename)
  yield* fs.writeFileString(temporary, options.contents, { mode: options.mode })
  return temporary
})

/**
 * Atomically publishes a staged file. `create` links it and fails with `AlreadyExists` instead of
 * replacing an existing file; `replace` renames it over the destination.
 */
export const install = Effect.fnUntraced(function* (
  temporary: string,
  destination: string,
  mode: "create" | "replace"
) {
  const fs = yield* FileSystem.FileSystem
  return yield* mode === "create" ? fs.link(temporary, destination) : fs.rename(temporary, destination)
})
