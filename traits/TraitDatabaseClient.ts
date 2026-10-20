import { LibsqlClient } from "@effect/sql-libsql"
import { Effect, FileSystem, Layer, Path } from "effect"

export const layer = Layer.effect(
  LibsqlClient.LibsqlClient,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-index-" })
    const url = yield* path.toFileUrl(path.join(directory, "traits.db"))
    return yield* LibsqlClient.make({ url })
  })
)
