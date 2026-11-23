import { Effect, FileSystem, Layer, Path } from "effect"
import { KeyValueStore } from "effect/persistence"

import * as DecisionCache from "../TraitRun/DecisionCache.ts"
import { LocalPaths } from "./LocalPaths.ts"

interface Model {
  readonly provider: string
  readonly model: string
}

/** Where a model's answers are kept under traits/.cache, apart from every other model's, since one model's answer says nothing about another's. */
const directoryOf = Effect.fnUntraced(function* (model: Model) {
  const path = yield* Path.Path
  const paths = yield* LocalPaths
  // A model's ID may hold slashes, which a directory's name cannot.
  return path.join(paths.cache, "decisions", encodeURIComponent(`${model.provider}/${model.model}`))
})

/** Remembers the model's answers as files under traits/.cache, apart for each model, since one model's answer says nothing about another's. The directory ignores itself in Git, so what it holds is neither committed nor checked. When it cannot be written to, answers are remembered for this run only. */
export const layer = (model: Model) =>
  DecisionCache.layerKeyValueStore.pipe(
    Layer.provide(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const paths = yield* LocalPaths
        yield* fs.makeDirectory(paths.cache, { recursive: true })
        const ignore = path.join(paths.cache, ".gitignore")
        const ignored = yield* fs.exists(ignore)
        if (!ignored) {
          yield* fs.writeFileString(ignore, "*\n")
        }
        const directory = yield* directoryOf(model)
        return KeyValueStore.layerFileSystem(directory)
      }).pipe(
        Layer.unwrap,
        Layer.catchTag("PlatformError", () => KeyValueStore.layerMemory)
      )
    )
  )

/** The answers already remembered for the model under traits/.cache, for something that only reads them, such as an estimate: where there are none, nothing is created, and there is simply nothing remembered. */
export const layerExisting = (model: Model) =>
  DecisionCache.layerKeyValueStore.pipe(
    Layer.provide(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const directory = yield* directoryOf(model)
        const exists = yield* fs.exists(directory)
        return exists ? KeyValueStore.layerFileSystem(directory) : KeyValueStore.layerMemory
      }).pipe(
        Layer.unwrap,
        Layer.catchTag("PlatformError", () => KeyValueStore.layerMemory)
      )
    )
  )
