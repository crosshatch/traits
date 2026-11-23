import { NodeServices } from "@effect/platform-node"
import { expect, layer } from "@effect/vitest"
import { Array, Clock, Effect, FileSystem, Layer, Option, Order, Path, pipe, PlatformError, Ref, Result } from "effect"

import { createFile, FileAlreadyExistsError } from "../util/fs/createFile.ts"
import { writeFile } from "../util/fs/writeFile.ts"

/** Runs the effect with a file path in a temporary directory, and that directory. */
const withFile = <A, E, R>(effect: (file: string, directory: string) => Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = yield* fs.makeTempDirectoryScoped()
    return yield* effect(path.join(directory, "data.json"), directory)
  })

/** The names of everything in a directory, in order. */
const entries = (directory: string) =>
  FileSystem.FileSystem.use((fs) => fs.readDirectory(directory)).pipe(Effect.map(Array.sort(Order.String)))

/** The file system with some of its operations replaced. */
const overriding = (
  operations: (fs: FileSystem.FileSystem) => Effect.Effect<Partial<FileSystem.FileSystem>>
): Layer.Layer<FileSystem.FileSystem, never, FileSystem.FileSystem> =>
  Layer.effect(
    FileSystem.FileSystem,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const replaced = yield* operations(fs)
      return { ...fs, ...replaced }
    })
  )

/** A file system whose first few moves fail for this reason, as when another process has the target open. */
const failingMoves = (failures: number, reason: PlatformError.SystemErrorTag) =>
  overriding(
    Effect.fnUntraced(function* (fs) {
      const remaining = yield* Ref.make(failures)
      return {
        rename: (from, to) =>
          Ref.getAndUpdate(remaining, (count) => count - 1).pipe(
            Effect.flatMap((count) =>
              count > 0
                ? Effect.fail(PlatformError.systemError({ _tag: reason, module: "FileSystem", method: "rename" }))
                : fs.rename(from, to)
            )
          )
      }
    })
  )

/** A file system that cannot link one file to another, such as exFAT. */
const withoutLinks = overriding(() =>
  Effect.succeed({
    link: () => Effect.fail(PlatformError.systemError({ _tag: "Unknown", module: "FileSystem", method: "link" }))
  })
)

const fileSystems = [
  ["links", Layer.empty],
  ["no links", withoutLinks]
] as const

const posix = process.platform !== "win32"

// The wait between attempts to replace a busy file, and the age of a leftover staging directory, use the real clock.
layer(NodeServices.layer, { excludeTestServices: true })((it) => {
  it.effect("replaces a file's contents, or creates the file, leaving nothing else behind", () =>
    withFile(
      Effect.fn(function* (file, directory) {
        const fs = yield* FileSystem.FileSystem
        yield* writeFile(file, "old")
        yield* writeFile(file, "new 😀")
        const text = yield* fs.readFileString(file)
        const left = yield* entries(directory)
        expect(text).toBe("new 😀")
        expect(left).toEqual(["data.json"])
      })
    )
  )

  it.effect("leaves the old file whole, and nothing else, when the new contents cannot be put in its place", () =>
    withFile(
      Effect.fn(function* (file, directory) {
        const fs = yield* FileSystem.FileSystem
        yield* fs.writeFileString(file, "old")
        const error = yield* writeFile(file, "new").pipe(
          Effect.provide(failingMoves(Number.POSITIVE_INFINITY, "Unknown")),
          Effect.flip
        )
        const text = yield* fs.readFileString(file)
        const left = yield* entries(directory)
        expect(error._tag).toBe("PlatformError")
        expect(text).toBe("old")
        expect(left).toEqual(["data.json"])
      })
    )
  )

  it.effect("tries again when the file is briefly held open by another process", () =>
    withFile(
      Effect.fn(function* (file) {
        const fs = yield* FileSystem.FileSystem
        yield* fs.writeFileString(file, "old")
        yield* writeFile(file, "new").pipe(Effect.provide(failingMoves(2, "Busy")))
        const text = yield* fs.readFileString(file)
        expect(text).toBe("new")
      })
    )
  )

  it.effect.runIf(posix)("keeps the permissions of a file it replaces", () =>
    withFile(
      Effect.fn(function* (file) {
        const fs = yield* FileSystem.FileSystem
        yield* fs.writeFileString(file, "old")
        yield* fs.chmod(file, 0o600)
        yield* writeFile(file, "new")
        const { mode } = yield* fs.stat(file)
        expect(mode & 0o777).toBe(0o600)
      })
    )
  )

  it.effect.runIf(posix)("replaces the file a symbolic link leads to, and leaves the link", () =>
    withFile(
      Effect.fn(function* (file, directory) {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const elsewhere = path.join(directory, "elsewhere")
        const real = path.join(elsewhere, "shared.json")
        yield* fs.makeDirectory(elsewhere)
        yield* fs.writeFileString(real, "old")
        yield* fs.symlink(real, file)

        yield* writeFile(file, "new")
        const link = yield* fs.lstat(file)
        const text = yield* fs.readFileString(real)
        const beside = yield* entries(elsewhere)
        const left = yield* entries(directory)
        expect(link.type).toBe("SymbolicLink")
        expect(text).toBe("new")
        expect(beside).toEqual(["shared.json"])
        expect(left).toEqual(["data.json", "elsewhere"])
      })
    )
  )

  it.effect("clears away what a write that stopped midway left behind, but not a write still under way", () =>
    withFile(
      Effect.fn(function* (file, directory) {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const now = yield* Clock.currentTimeMillis
        const stale = path.join(directory, ".write-stale")
        yield* fs.makeDirectory(stale)
        yield* fs.writeFileString(path.join(stale, "data.json"), "half")
        // Two minutes ago, in seconds.
        yield* fs.utimes(stale, now / 1000 - 120, now / 1000 - 120)
        yield* fs.makeDirectory(path.join(directory, ".write-fresh"))

        yield* writeFile(file, "new")
        const left = yield* entries(directory)
        expect(left).toEqual([".write-fresh", "data.json"])
      })
    )
  )

  it.effect.each(fileSystems)("creates a file only when none has its path, on a file system with %s", ([, files]) =>
    withFile(
      Effect.fn(function* (file, directory) {
        const fs = yield* FileSystem.FileSystem
        yield* createFile(file, "first").pipe(Effect.provide(files))
        const taken = yield* createFile(file, "second").pipe(Effect.provide(files), Effect.flip)
        const text = yield* fs.readFileString(file)
        const left = yield* entries(directory)
        expect(taken).toEqual(FileAlreadyExistsError.make({ file }))
        expect(text).toBe("first")
        expect(left).toEqual(["data.json"])
      })
    )
  )

  it.effect.each(fileSystems)(
    "lets exactly one of many creations of the same file at once succeed, on a file system with %s",
    ([, files]) =>
      withFile(
        Effect.fn(function* (file, directory) {
          const fs = yield* FileSystem.FileSystem
          const attempts = yield* Effect.forEach(
            Array.range(0, 24),
            (attempt) => Effect.result(createFile(file, `attempt ${attempt}`)),
            { concurrency: "unbounded" }
          ).pipe(Effect.provide(files))
          const text = yield* fs.readFileString(file)
          const left = yield* entries(directory)
          const won = pipe(
            Array.findFirstIndex(attempts, Result.isSuccess),
            Option.map((attempt) => `attempt ${attempt}`)
          )
          expect(Array.filter(attempts, Result.isSuccess)).toHaveLength(1)
          expect(Array.filter(attempts, Result.isFailure)).toEqual(
            Array.replicate(Result.fail(FileAlreadyExistsError.make({ file })), 24)
          )
          expect(won).toEqual(Option.some(text))
          expect(left).toEqual(["data.json"])
        })
      )
  )

  it.effect("gives the path back when a file cannot be created on a file system with no links", () =>
    withFile(
      Effect.fn(function* (file, directory) {
        const error = yield* createFile(file, "new").pipe(
          Effect.provide(failingMoves(Number.POSITIVE_INFINITY, "Unknown").pipe(Layer.provide(withoutLinks))),
          Effect.flip
        )
        const left = yield* entries(directory)
        expect(error._tag).toBe("PlatformError")
        expect(left).toEqual([])
      })
    )
  )
})
