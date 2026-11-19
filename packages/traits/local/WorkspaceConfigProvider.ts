import { Array, ConfigProvider, Effect, FileSystem, Path, String } from "effect"

import * as Git from "./Git.ts"
import { WorkspaceRoot } from "./WorkspaceRoot.ts"

/** The main checkout root shared by the workspace's linked worktrees; undefined outside Git. */
const mainCheckoutRoot = Effect.gen(function* () {
  const path = yield* Path.Path
  const { directory } = yield* WorkspaceRoot
  const { exitCode, stdout } = yield* Git.commonDirectory(directory)
  const commonDirectory = String.trim(stdout)
  return exitCode === 0 && commonDirectory !== "" ? path.dirname(commonDirectory) : undefined
}).pipe(Effect.orElseSucceed(() => undefined))

/** Falls back from the process environment to the workspace's .env, then to the main checkout's .env, so linked worktrees share its credentials. */
export const layer = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { directory } = yield* WorkspaceRoot
  const root = yield* mainCheckoutRoot
  const files = Array.dedupe([path.join(directory, ".env"), ...(root === undefined ? [] : [path.join(root, ".env")])])
  // The workspace's .env takes precedence over the main checkout's, in file order.
  return yield* Effect.forEach(
    files,
    (file) =>
      fs
        .exists(file)
        .pipe(
          Effect.flatMap((exists) =>
            exists ? ConfigProvider.fromDotEnv({ path: file }).pipe(Effect.asSome) : Effect.succeedNone
          )
        ),
    { concurrency: 1 }
  ).pipe(Effect.map(Array.getSomes), Effect.map(Array.reduce(ConfigProvider.fromUnknown({}), ConfigProvider.orElse)))
}).pipe(Effect.withSpan("WorkspaceConfigProvider.load"), ConfigProvider.layerAdd)
