import { Context, Effect, Layer, Path } from "effect"
import { UserDirectories } from "effect/persistence"

/** User-level filesystem locations used by the local CLI. */
export class WorkspacePaths extends Context.Service<
  WorkspacePaths,
  {
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
    const { config, data } = yield* UserDirectories.UserDirectories
    const { configDirectory, dataDirectory } = yield* Effect.all(
      {
        configDirectory: config("traits"),
        dataDirectory: data("traits")
      },
      { concurrency: "unbounded" }
    )
    return WorkspacePaths.of({
      configDirectory,
      dataDirectory,
      config: path.join(configDirectory, "profiles.json"),
      accounts: path.join(dataDirectory, "credentials.json"),
      lock: path.join(dataDirectory, "cli.lock")
    })
  })
)
