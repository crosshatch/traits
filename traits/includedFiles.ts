import { Array, Effect, Equal, Path, pipe, PlatformError, Stream, String } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

import { TraitsContext } from "./TraitsContext.ts"

export const includedFiles = Effect.gen(function* () {
  const context = yield* TraitsContext
  if (!context.config.excludeGitignored) return undefined

  const path = yield* Path.Path
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const process = yield* spawner.spawn(
    ChildProcess.make`git ls-files --cached --others --exclude-standard --full-name -z`.pipe(
      ChildProcess.setCwd(context.configRoot)
    )
  )
  const output = yield* process.stdout.pipe(Stream.decodeText(), Stream.mkString)
  yield* process.exitCode.pipe(
    Effect.filterOrFail(Equal.equals(0), (exitCode) =>
      PlatformError.systemError({
        _tag: "Unknown",
        module: "ChildProcess",
        method: "git ls-files",
        description: `Process exited with code ${exitCode}`
      })
    )
  )
  return pipe(
    output,
    String.split("\0"),
    Array.filter(String.isNonEmpty),
    Array.map((file) => path.resolve(context.configRoot, file)),
    (files) => new Set(files)
  )
}).pipe(Effect.scoped, Effect.withSpan("includedFiles"))
