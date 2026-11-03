import { Context, Effect, FileSystem, Layer, Path } from "effect"
import { UserDirectories } from "effect/persistence"

/** Workspace and user-level filesystem locations used by the local CLI. */
export class WorkspacePaths extends Context.Service<
  WorkspacePaths,
  {
    readonly cwd: string
    readonly traitsDirectory: string
    readonly environmentsDirectory: string
    readonly configDirectory: string
    readonly dataDirectory: string
    readonly config: string
    readonly accounts: string
    readonly lock: string
  }
>()("traits-next/Cli/WorkspacePaths") {}

export const layer = Layer.effect(
  WorkspacePaths,
  Effect.gen(function* () {
    const path = yield* Path.Path
    const cwd = path.resolve()
    const traitsDirectory = path.join(cwd, "traits")
    const { config, data } = yield* UserDirectories.UserDirectories
    const { configDirectory, dataDirectory } = yield* Effect.all(
      {
        configDirectory: config("traits"),
        dataDirectory: data("traits")
      },
      { concurrency: "unbounded" }
    )
    return WorkspacePaths.of({
      cwd,
      traitsDirectory,
      environmentsDirectory: path.join(traitsDirectory, "environments"),
      configDirectory,
      dataDirectory,
      config: path.join(configDirectory, "profiles.json"),
      accounts: path.join(dataDirectory, "credentials.json"),
      lock: path.join(dataDirectory, "cli.lock")
    })
  })
)

/** Canonical nearest project root (.git or traits marker), falling back to the current directory. */
export const root = Effect.gen(function* () {
  const { cwd } = yield* WorkspacePaths
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const canonicalCwd = yield* fs.realPath(cwd)
  let directory = canonicalCwd
  while (true) {
    const markers = yield* Effect.all(
      [fs.exists(path.join(directory, ".git")), fs.exists(path.join(directory, "traits"))],
      { concurrency: "unbounded" }
    )
    if (markers[0] || markers[1]) {
      return directory
    }
    const parent = path.dirname(directory)
    if (parent === directory) {
      return canonicalCwd
    }
    directory = parent
  }
}).pipe(Effect.withSpan("WorkspacePaths.root"))
