import { Effect, FileSystem, Path } from "effect"

import { moveFile } from "./moveFile.ts"
import { stageFile } from "./stageFile.ts"

/** Creates the file, or replaces its contents, in one step: another process reads either the old contents or the new, never part of one, and a write that fails leaves the old file as it was. A replaced file keeps its permissions, and a symbolic link stays a link to the file that is replaced. */
export const writeFile = Effect.fnUntraced(function* (file: string, contents: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  // Moving a file onto a symbolic link would replace the link, so the file it leads to is the one to replace.
  const target = yield* fs
    .realPath(file)
    .pipe(Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed(file)))
  const staged = yield* stageFile(path.dirname(target), path.basename(target), contents)
  yield* fs.stat(target).pipe(
    // The mode also holds the kind of file, which is not a permission.
    Effect.flatMap(({ mode }) => fs.chmod(staged, mode & 0o7777)),
    // A new file gets the default permissions.
    Effect.catchReason("PlatformError", "NotFound", () => Effect.void)
  )
  yield* moveFile(staged, target)
}, Effect.scoped)
