import { Array, ConfigProvider, Effect, FileSystem, Option, Path, Schema as S } from "effect"

import { LocalPaths, mainRoot } from "./LocalPaths.ts"

/** No .env file was found where one was named. */
export class EnvFileNotFoundError extends S.TaggedError<EnvFileNotFoundError>()("EnvFileNotFoundError", {
  /** The file as it was named. */
  file: S.String.annotateKey({ description: "The file as it was named." }),
  /** The paths it was looked for at, in order. */
  searched: S.Array(S.String).annotateKey({ description: "The paths it was looked for at, in order." })
}) {
  override get message() {
    return `No file named ${this.file} was found at ${Array.join(this.searched, ", ")}.`
  }
}

/** Finds a .env file by the path it was named by. An absolute path is taken as it is. A relative one is looked for from the current directory, then from the workspace root, and then from the root of the repository's main working tree, which in a linked worktree is where an ignored file such as .env usually is. */
export const find = Effect.fn("LocalEnvFile.find")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const paths = yield* LocalPaths
  const main = path.isAbsolute(file) ? Option.none() : yield* mainRoot
  const candidates = path.isAbsolute(file)
    ? [file]
    : Array.dedupe([
        path.resolve(file),
        path.join(paths.root, file),
        ...Option.toArray(Option.map(main, (root) => path.join(root, file)))
      ])
  const found = yield* Effect.findFirst(candidates, (candidate) =>
    fs.exists(candidate).pipe(Effect.orElseSucceed(() => false))
  )
  if (Option.isNone(found)) {
    return yield* EnvFileNotFoundError.make({ file, searched: candidates })
  }
  return found.value
})

/** Reads configuration, such as the model's credentials, from the .env file that find finds by this path, as well as from the environment. A variable the environment already sets takes precedence over the file. */
export const layer = (file: string) =>
  ConfigProvider.layerAdd(find(file).pipe(Effect.flatMap((path) => ConfigProvider.fromDotEnv({ path }))))
