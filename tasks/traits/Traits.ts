import { Effect, FileSystem, Path } from "effect"

import type { Trait } from "./Domain.ts"
import { TraitsContext } from "./TraitsContext.ts"

export const load = Effect.fn("traits.load")(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { traitsDir } = yield* TraitsContext
  const filenames = (yield* fs.readDirectory(traitsDir)).filter((name) => name.endsWith(".md")).sort()
  return yield* Effect.forEach(
    filenames,
    Effect.fn("traits.loadTrait")(function* (filename) {
      return {
        name: filename.slice(0, -3),
        path: `.agents/traits/${filename}`,
        content: yield* fs.readFileString(path.join(traitsDir, filename))
      } satisfies Trait
    }),
    { concurrency: "unbounded" }
  )
})
