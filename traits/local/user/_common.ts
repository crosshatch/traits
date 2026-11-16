import { Effect, FileSystem, Path, Schema as S } from "effect"

import { UserFileSecurity } from "./UserFileSecurity.ts"

/** A name the user gives a saved account or profile: lowercase letters, digits, dots, underscores, or hyphens, starting with a letter or digit. It carries no description, so each name built on it describes its own meaning. */
export const SavedName = S.String.check(
  S.isPattern(/^[a-z0-9][a-z0-9._-]*$/u, {
    message: "Expected lowercase letters, digits, dots, underscores, or hyphens, starting with a letter or digit."
  })
)

/** Replaces a file atomically after securing its directory and temporary file. */
export const writeAtomic = Effect.fn("writeAtomic")(function* (filename: string, text: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const secure = yield* UserFileSecurity
  yield* fs.makeDirectory(path.dirname(filename), { recursive: true, mode: 0o700 })
  yield* secure(path.dirname(filename), "Directory")
  const temporary = yield* fs.makeTempFileScoped({ directory: path.dirname(filename), prefix: ".traits-" })
  yield* secure(temporary, "File")
  yield* fs.writeFileString(temporary, text, { mode: 0o600 })
  yield* fs.rename(temporary, filename)
}, Effect.scoped)
