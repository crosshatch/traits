import { Effect, FileSystem, Path, Schema as S } from "effect"

import { moveFile } from "./moveFile.ts"
import { stageFile } from "./stageFile.ts"

/** A file already has the path a new file was to be created at. */
export class FileAlreadyExistsError extends S.TaggedError<FileAlreadyExistsError>()("FileAlreadyExistsError", {
  /** The path a file already has. */
  file: S.String.annotateKey({ description: "The path a file already has." })
}) {
  override get message() {
    return `There is already a file at ${this.file}.`
  }
}

/** Creates the file with these contents, failing when a file already has its path. Checking and creating are one step, so of several processes creating the same file only one succeeds. */
export const createFile = Effect.fnUntraced(function* (file: string, contents: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const staged = yield* stageFile(path.dirname(file), path.basename(file), contents)
  // A link fails when the path is taken, where moving the file into place would replace what is there.
  yield* fs.link(staged, file).pipe(
    Effect.catchReason(
      "PlatformError",
      "AlreadyExists",
      () => FileAlreadyExistsError.make({ file }),
      // Some file systems, such as exFAT, have no links. There an empty file claims the path, and the staged file then replaces it; until it does, a reader finds the file empty.
      () =>
        fs.writeFile(file, new Uint8Array(), { flag: "wx" }).pipe(
          Effect.catchReason("PlatformError", "AlreadyExists", () => FileAlreadyExistsError.make({ file })),
          Effect.andThen(moveFile(staged, file).pipe(Effect.onError(() => Effect.ignore(fs.remove(file)))))
        )
    )
  )
}, Effect.scoped)
