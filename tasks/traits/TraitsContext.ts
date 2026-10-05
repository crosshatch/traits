import { ConfigProvider, Context, Effect, FileSystem, Layer, Path, Schema as S } from "effect"

import { git } from "./_util.ts"
import { TraitsConfig } from "./TraitsConfig.ts"

export class TraitsContext extends Context.Service<TraitsContext>()("root/tasks/traits/TraitsContext", {
  make: Effect.gen(function* () {
    const path = yield* Path.Path
    const fs = yield* FileSystem.FileSystem
    const root = (yield* git(["rev-parse", "--show-toplevel"])).trimEnd()
    const configUrl = yield* path.toFileUrl(path.join(root, "traits.ts"))
    const module = yield* Effect.promise(() => import(configUrl.href))
    const config = yield* S.decodeUnknownEffect(TraitsConfig)(module.default)
    const commonDir = (yield* git(["rev-parse", "--path-format=absolute", "--git-common-dir"])).trimEnd()
    let configProvider = yield* ConfigProvider.ConfigProvider
    for (const directory of new Set([root, path.dirname(commonDir)])) {
      const fallback = yield* ConfigProvider.fromDotEnv({ path: path.join(directory, ".env") }).pipe(
        Effect.catchIf(
          (error) => error.reason._tag === "NotFound",
          () => Effect.succeed(ConfigProvider.fromUnknown({}))
        )
      )
      configProvider = ConfigProvider.orElse(configProvider, fallback)
    }
    const traitsDir = path.join(root, ".agents", "traits")
    yield* fs.makeDirectory(traitsDir, { recursive: true })
    return { root, traitsDir, commonDir, config, configProvider }
  })
}) {
  static readonly layer = Layer.effect(this, this.make)
}
