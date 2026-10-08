import { Array, ConfigProvider, Effect, FileSystem, Path, String } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

export const layer = ConfigProvider.layerAdd(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const root = yield* spawner.string(ChildProcess.make`git rev-parse --show-toplevel`).pipe(Effect.map(String.trim))
    const gitDir = yield* spawner
      .string(ChildProcess.make`git rev-parse --path-format=absolute --git-common-dir`)
      .pipe(Effect.map(String.trim))
    const files = Array.dedupe([path.join(root, ".env"), path.join(path.dirname(gitDir), ".env")])
    let provider = ConfigProvider.fromUnknown({})
    for (const file of files) {
      if (yield* fs.exists(file)) {
        provider = yield* ConfigProvider.fromDotEnv({ path: file }).pipe(
          Effect.map((value) => ConfigProvider.orElse(provider, value))
        )
      }
    }
    return provider
  })
)
