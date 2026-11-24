import { Array, Clock, Effect, FileSystem, Option, Path, Schedule, Schema as S, String } from "effect"

// The name starts with a dot and has no extension, so a staging directory is not taken for one of the directory's own entries.
const stagingPrefix = ".write-"

/** A file already has the path a new file was to be created at. */
export class AlreadyExistsError extends S.TaggedError<AlreadyExistsError>()("AlreadyExistsError", {
  /** The path a file already has. */
  file: S.String.annotateKey({ description: "The path a file already has." })
}) {
  override get message() {
    return `There is already a file at ${this.file}.`
  }
}

/** Removes the directory's entries whose names start with the prefix and that are over a minute old, such as what a process leaves behind when it stops in the middle of a write. It never fails, so it can run before the work it tidies up after. */
const removeStale = Effect.fnUntraced(
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

/** Moves a file to another path on the same file system in one step, replacing a file that is there. */
const move = Effect.fnUntraced(function* (from: string, to: string) {
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

/** Writes the contents to a file of the same name in a new staging directory beside the file, and returns its path. It requires a `Scope`: the staging directory is removed when the scope closes, so the staged file must be moved or linked into place before then. Staging directories that an earlier write left behind are cleared away first. */
const stage = Effect.fnUntraced(function* (file: string, contents: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const directory = path.dirname(file)
  yield* removeStale(directory, stagingPrefix)
  // It is inside the file's directory so that putting the file in place stays within one file system.
  const staging = yield* fs.makeTempDirectoryScoped({ directory, prefix: stagingPrefix })
  const staged = path.join(staging, path.basename(file))
  yield* Effect.gen(function* () {
    const handle = yield* fs.open(staged, { flag: "w" })
    yield* handle.writeAll(new TextEncoder().encode(contents))
    // The contents must be on disk before the file takes its place, or a power loss could leave an empty file there.
    yield* handle.sync
  }).pipe(Effect.scoped)
  return staged
})

/** Creates the file, or replaces its contents, in one step. Another process reads either the old contents or the new, never part of one, and a write that fails leaves the old file as it was. A replaced file keeps its permissions, and a symbolic link stays a link to the file that is replaced. */
export const write = Effect.fnUntraced(function* (file: string, contents: string) {
  const fs = yield* FileSystem.FileSystem
  // Moving a file onto a symbolic link would replace the link, so the file it leads to is the one to replace.
  const target = yield* fs
    .realPath(file)
    .pipe(Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed(file)))
  const staged = yield* stage(target, contents)
  yield* fs.stat(target).pipe(
    // The mode also holds the kind of file, which is not a permission.
    Effect.flatMap(({ mode }) => fs.chmod(staged, mode & 0o7777)),
    // A new file gets the default permissions.
    Effect.catchReason("PlatformError", "NotFound", () => Effect.void)
  )
  yield* move(staged, target)
}, Effect.scoped)

/** Creates the file with these contents, failing when a file already has its path. Checking and creating are one step, so of several processes creating the same file only one succeeds. */
export const create = Effect.fnUntraced(function* (file: string, contents: string) {
  const fs = yield* FileSystem.FileSystem
  const staged = yield* stage(file, contents)
  // A link fails when the path is taken, where moving the file into place would replace what is there.
  yield* fs.link(staged, file).pipe(
    Effect.catchReason(
      "PlatformError",
      "AlreadyExists",
      () => AlreadyExistsError.make({ file }),
      // Some file systems, such as exFAT, have no links. There an empty file claims the path, and the staged file then replaces it; until it does, a reader finds the file empty.
      () =>
        fs.writeFile(file, new Uint8Array(), { flag: "wx" }).pipe(
          Effect.catchReason("PlatformError", "AlreadyExists", () => AlreadyExistsError.make({ file })),
          Effect.andThen(move(staged, file).pipe(Effect.onError(() => Effect.ignore(fs.remove(file)))))
        )
    )
  )
}, Effect.scoped)
