import { Effect, FileSystem, Layer, Option, Path } from "effect"
import { KeyValueStore } from "effect/persistence"

import * as DecisionCache from "../TraitRun/DecisionCache.ts"
import { LocalPaths, mainRoot } from "./LocalPaths.ts"

interface Model {
  readonly provider: string
  readonly model: string
}

/** Where a model's answers are kept under a traits/.cache: in a directory of its own, since one model's answer says nothing about another's. */
const directoryOf = Effect.fnUntraced(function* (cache: string, model: Model) {
  const path = yield* Path.Path
  // A model's ID may hold slashes, which a directory's name cannot.
  return path.join(cache, "decisions", encodeURIComponent(`${model.provider}/${model.model}`))
})

/** A cache that keeps answers as the files of a directory, which is made if it is not there. */
const filesIn = (directory: string) =>
  DecisionCache.makeKeyValueStore.pipe(Effect.provide(KeyValueStore.layerFileSystem(directory)))

/** A cache with nothing remembered, which keeps nothing. */
const nothing = DecisionCache.DecisionCache.of({ recall: () => Effect.succeed({}), remember: () => Effect.void })

/** What the files of a directory remember, read and never added to. Where there is no such directory, none is made, and there is simply nothing remembered. */
const reading = Effect.fnUntraced(
  function* (directory: string) {
    const fs = yield* FileSystem.FileSystem
    const exists = yield* fs.exists(directory)
    if (!exists) {
      return nothing
    }
    return yield* filesIn(directory).pipe(Effect.map(DecisionCache.readOnly))
  },
  Effect.tapError((error) =>
    Effect.logWarning(`What the model answered before cannot be read, so it is asked again: ${error.message}`)
  ),
  Effect.orElseSucceed(() => nothing)
)

/** What the files of a directory in the workspace's traits/.cache remember, added to with what the model answers. The directory is made if it is not there, and the cache ignores itself in Git, so what it holds is neither committed nor checked. When the directory cannot be made or written to, a warning says so once, and what it already holds is read without anything being added. */
const keeping = Effect.fnUntraced(
  function* (directory: string) {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const paths = yield* LocalPaths
    yield* fs.makeDirectory(directory, { recursive: true })
    const ignore = path.join(paths.cache, ".gitignore")
    const ignored = yield* fs.exists(ignore)
    if (!ignored) {
      yield* fs.writeFileString(ignore, "*\n")
    }
    // Found out once here, rather than by every answer of a run that then cannot be kept.
    yield* fs.access(directory, { writable: true })
    return yield* filesIn(directory)
  },
  Effect.tapError((error) =>
    Effect.logWarning(`What the model answers cannot be kept, so it is asked again next time: ${error.message}`)
  ),
  (effect, directory) => effect.pipe(Effect.catchTags({ PlatformError: () => reading(directory) }))
)

/** A workspace's cache of a model's answers: those under its own traits/.cache, read or kept as the given use of their directory has it, and in a worktree those of the checkout it was added from as well, which are only read. A worktree so starts from what was answered there, as it reads that checkout's .env. What it is told itself it keeps itself, and its own answer to a question takes the place of that checkout's. */
const make = Effect.fnUntraced(function* <E, R>(
  model: Model,
  use: (directory: string) => Effect.Effect<DecisionCache.DecisionCache["Service"], E, R>
) {
  const path = yield* Path.Path
  const paths = yield* LocalPaths
  const own = yield* directoryOf(paths.cache, model).pipe(Effect.flatMap(use))
  const main = yield* mainRoot
  // The same place under that checkout's root as the workspace's own cache has under its root.
  const shared = Option.map(main, (root) => path.join(root, path.relative(paths.root, paths.cache)))
  // A workspace that is not a worktree added from another checkout is its own main working tree, with no other cache to read.
  if (Option.isNone(shared) || shared.value === paths.cache) {
    return own
  }
  const checkout = yield* directoryOf(shared.value, model).pipe(Effect.flatMap(reading))
  return DecisionCache.DecisionCache.of({
    recall: (key) =>
      Effect.zipWith(
        // What cannot be read there is for a run there to report and replace.
        Effect.orElseSucceed(checkout.recall(key), (): DecisionCache.Answers => ({})),
        own.recall(key),
        (theirs, ours) => ({ ...theirs, ...ours }),
        { concurrent: true }
      ),
    remember: own.remember
  })
})

/** Remembers the model's answers as files under traits/.cache, apart for each model, since one model's answer says nothing about another's. The directory ignores itself in Git, so what it holds is neither committed nor checked. A worktree also recalls what the checkout it was added from remembers. When the directory cannot be made or written to, a warning says so once, and what it already holds is read without anything being added. */
export const layer = (model: Model) => Layer.effect(DecisionCache.DecisionCache, make(model, keeping))

/** The answers already remembered for the model under traits/.cache, and in a worktree those of the checkout it was added from, read and never added to, for something that only reads them, such as an estimate: where there are none, nothing is created, and there is simply nothing remembered. */
export const layerExisting = (model: Model) => Layer.effect(DecisionCache.DecisionCache, make(model, reading))
