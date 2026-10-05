import { Effect, FileSystem, Option, Path, Ref } from "effect"

import { type Trait } from "./Domain.ts"
import { TraitsContext } from "./TraitsContext.ts"

export const load = Effect.fn("traits.load")(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { traitsDir, traitsCache } = yield* TraitsContext
  const filenames = (yield* fs.readDirectory(traitsDir)).filter((name) => name.endsWith(".md")).sort()
  const versions = yield* Effect.forEach(
    filenames,
    Effect.fn("traits.statTrait")(function* (filename) {
      const info = yield* fs.stat(path.join(traitsDir, filename))
      return `${filename}\0${info.size}:${Option.getOrUndefined(info.mtime)?.getTime()}:${Option.getOrUndefined(info.birthtime)?.getTime()}:${Option.getOrUndefined(info.ino)}`
    }),
    { concurrency: "unbounded" }
  )
  const cached = yield* Ref.get(traitsCache)
  if (
    cached !== undefined &&
    versions.length === cached.versions.length &&
    versions.every((version, index) => version === cached.versions[index])
  )
    return cached.traits
  const traits = yield* Effect.forEach(
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
  yield* Ref.set(traitsCache, { versions, traits })
  return traits
})
