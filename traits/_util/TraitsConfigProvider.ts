import { Array, ConfigProvider, Effect, FileSystem, Path } from "effect"

import { getGitRoot, getWorktreeRoot } from "./Git.ts"

export const layer = ConfigProvider.layerAdd(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const worktreeRoot = yield* getWorktreeRoot
    const gitRoot = yield* getGitRoot
    const files = Array.dedupe([path.join(worktreeRoot, ".env"), path.join(gitRoot, ".env")])
    let provider = ConfigProvider.fromUnknown({})
    for (const file of files) {
      if (yield* fs.exists(file)) {
        provider = yield* ConfigProvider.fromDotEnv({ path: file }).pipe(
          Effect.map((value) => ConfigProvider.orElse(provider, value))
        )
      }
    }
    return provider
  }).pipe(Effect.withSpan("TraitsConfigProvider.load"))
)
