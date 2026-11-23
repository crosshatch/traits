import { Effect, FileSystem, Path } from "effect"

import { removeStale } from "./removeStale.ts"

// The name starts with a dot and has no extension, so a staging directory is not taken for one of the directory's own entries.
const stagingPrefix = ".write-"

/** Writes the contents to a file of this name in a new staging directory inside the directory, and returns its path. The staging directory is removed when the scope closes, so the file must be moved or linked into place before then. Staging directories that an earlier write left behind are cleared away first. */
export const stageFile = Effect.fnUntraced(function* (directory: string, name: string, contents: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  yield* removeStale(directory, stagingPrefix)
  // It is inside the directory so that putting the file in place stays within one file system.
  const staging = yield* fs.makeTempDirectoryScoped({ directory, prefix: stagingPrefix })
  const staged = path.join(staging, name)
  yield* Effect.gen(function* () {
    const handle = yield* fs.open(staged, { flag: "w" })
    yield* handle.writeAll(new TextEncoder().encode(contents))
    // The contents must be on disk before the file takes its place, or a power loss could leave an empty file there.
    yield* handle.sync
  }).pipe(Effect.scoped)
  return staged
})
