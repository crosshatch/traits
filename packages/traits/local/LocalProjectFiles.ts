import { Array, Effect, FileSystem, Glob, Option, Order, Path, pipe, String } from "effect"
import type { ChildProcessSpawner } from "effect/process"

import { StorageError } from "../StorageError.ts"
import type { Files } from "../TraitRun/TraitRun.ts"
import { runProcess } from "../util/process/runProcess.ts"
import { LocalPaths } from "./LocalPaths.ts"

/** The files of the project in the workspace, for a run to check, taken from Git: those it tracks and those it would track, which leaves out what it ignores, less the files that any of the given patterns matches, such as those under exclude in traits/config.json. They are listed, and each file read, on every use, so nothing is kept from one run to the next. */
export const make = Effect.fn("LocalProjectFiles.make")(function* (exclude: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const paths = yield* LocalPaths
  const services = yield* Effect.context<ChildProcessSpawner.ChildProcessSpawner>()
  // A root that could not be written as a URL would be a root that was never resolved.
  const root = yield* Effect.orDie(path.toFileUrl(paths.root))
  const excluded = Array.map(exclude, (pattern) => Glob.make(pattern, { dot: true }))

  return {
    root,
    paths: Effect.gen(function* () {
      const { exitCode, stderr, stdout } = yield* runProcess({
        command: "git",
        // Names are separated by a zero byte and left unquoted, so any character in a name survives.
        args: ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        cwd: paths.root
      }).pipe(
        Effect.mapError((cause) => StorageError.make({ location: paths.root, reason: { _tag: "Unreadable" }, cause }))
      )
      if (exitCode !== 0) {
        return yield* StorageError.make({
          location: paths.root,
          reason: { _tag: "Unreadable" },
          cause: new Error(`Git could not list the project's files: ${String.trim(stderr)}`)
        })
      }
      return pipe(
        stdout,
        String.split("\u0000"),
        Array.filter(String.isNonEmpty),
        Array.filter((file) => !Array.some(excluded, (glob) => Glob.match(glob, file))),
        // A file with a merge conflict is listed once per version.
        Array.dedupe,
        Array.sort(Order.String)
      )
    }).pipe(Effect.provide(services), Effect.withSpan("LocalProjectFiles.paths")),
    read: Effect.fn("LocalProjectFiles.read")(function* (file) {
      const absolute = path.join(paths.root, file)
      const bytes = yield* fs.readFile(absolute).pipe(
        Effect.asSome,
        // Git still lists a file that was deleted without being staged, and lists a submodule, which is a directory.
        Effect.catchReasons(
          "PlatformError",
          { NotFound: () => Effect.succeedNone, BadResource: () => Effect.succeedNone },
          (_, cause) => StorageError.make({ location: absolute, reason: { _tag: "Unreadable" }, cause })
        )
      )
      if (Option.isNone(bytes)) {
        return Option.none()
      }
      const text = Option.liftThrowable(() => new TextDecoder("utf-8", { fatal: true }).decode(bytes.value))()
      // Bytes that are not UTF-8, or that hold a zero byte, are a binary file.
      if (Option.isNone(text) || pipe(text.value, String.includes("\u0000"))) {
        return Option.none()
      }
      const uri = yield* Effect.orDie(path.toFileUrl(absolute))
      return Option.some({ uri, text: text.value })
    })
  } satisfies Files
})
