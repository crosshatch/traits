import { expect } from "@effect/vitest"
import { Array, Effect, FileSystem, Layer, Path, Stream, String } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

import { LocalPaths } from "../local/LocalPaths.ts"
import PackageJson from "../package.json" with { type: "json" }

/** The paths of a workspace whose traits directory is this one, without looking for the Git repository it belongs to. */
export const localPaths = (directory: string) =>
  Layer.effect(
    LocalPaths,
    Effect.gen(function* () {
      const path = yield* Path.Path
      return {
        root: path.dirname(directory),
        directory,
        config: path.join(directory, "config.json"),
        sourcesLock: path.join(directory, "sources.lock.json"),
        cache: path.join(directory, ".cache")
      }
    })
  )

/** The text of a traits/config.json with these fields besides the version and models it must have. */
export const configText = (fields: {
  readonly version?: string
  readonly sources?: unknown
  readonly selections?: unknown
  readonly exclude?: unknown
  readonly segmentation?: unknown
}) =>
  JSON.stringify({
    version: PackageJson.version,
    models: { decision: { provider: "openai", model: "decision" } },
    ...fields
  })

/** Runs Git in a directory, without the machine's own Git configuration, and returns what it printed. */
export const git = Effect.fn("git")(function* (cwd: string, ...args: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  // An empty file stands in for the user's configuration. Git cannot open the null device on Windows, so it is not used.
  const config = yield* fs.makeTempFileScoped()
  const handle = yield* spawner.spawn(
    ChildProcess.make("git", args, {
      cwd,
      env: {
        GIT_CONFIG_GLOBAL: config,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@example.com",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@example.com"
      },
      extendEnv: true
    })
  )
  const output = yield* Stream.mkString(Stream.decodeText(handle.all))
  const exitCode = yield* handle.exitCode
  expect(exitCode, `git ${Array.join(args, " ")}: ${output}`).toBe(0)
  return String.trim(output)
}, Effect.scoped)
