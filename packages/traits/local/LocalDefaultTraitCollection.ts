import { Effect, FileSystem, Layer, Path, Semaphore } from "effect"

import { StorageError } from "../StorageError.ts"
import type { Trait } from "../Trait/Trait.ts"
import * as TraitFile from "../Trait/TraitFile.ts"
import type { TraitName } from "../Trait/TraitName.ts"
import { DefaultTraitCollection, TraitAlreadyExistsError } from "../TraitCollection/DefaultTraitCollection.ts"
import { TraitNotFoundError } from "../TraitCollection/TraitCollection.ts"
import { createFile } from "../util/fs/createFile.ts"
import { writeFile } from "../util/fs/writeFile.ts"
import { LocalPaths } from "./LocalPaths.ts"
import * as LocalTraitCollection from "./LocalTraitCollection.ts"
import * as LocalTraitFile from "./LocalTraitFile.ts"

/** Keeps the workspace's own traits as the <name>.md files directly under traits/. Directories there, which hold the traits of declared sources, are not part of it. */
export const layer = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const paths = yield* LocalPaths
  const platform = yield* Effect.context<FileSystem.FileSystem | Path.Path>()
  const traits = yield* LocalTraitCollection.get(paths.directory)
  // A change may read a trait's file and then write or remove files, so changes run one at a time.
  const changes = yield* Semaphore.make(1)

  const file = (name: TraitName) => path.join(paths.directory, LocalTraitFile.fileName(name))

  const write = (trait: Trait) =>
    writeFile(file(trait.name), TraitFile.serialize(trait)).pipe(
      Effect.provide(platform),
      Effect.mapError((cause) =>
        StorageError.make({ location: file(trait.name), reason: { _tag: "Unwritable" }, cause })
      )
    )

  const remove = (name: TraitName) =>
    fs.remove(file(name)).pipe(
      Effect.catchReason(
        "PlatformError",
        "NotFound",
        () => TraitNotFoundError.make({ traitName: name }),
        (_, cause) => StorageError.make({ location: file(name), reason: { _tag: "Unwritable" }, cause })
      )
    )

  return DefaultTraitCollection.of({
    ...traits,
    write: Effect.fn("LocalDefaultTraitCollection.write")(write, Semaphore.withPermit(changes)),
    update: Effect.fn("LocalDefaultTraitCollection.update")(function* (name, f) {
      const trait = yield* traits.get(name)
      const updated = { ...f(trait), name }
      yield* write(updated)
      return updated
    }, Semaphore.withPermit(changes)),
    rename: Effect.fn("LocalDefaultTraitCollection.rename")(function* (from, to) {
      const trait = yield* traits.get(from)
      const renamed = { ...trait, name: to }
      // Creating the file is also the check that the name is free, so another process cannot take it in between.
      yield* createFile(file(to), TraitFile.serialize(renamed)).pipe(
        Effect.provide(platform),
        Effect.catchTags({
          FileAlreadyExistsError: () => TraitAlreadyExistsError.make({ traitName: to }),
          PlatformError: (cause) => StorageError.make({ location: file(to), reason: { _tag: "Unwritable" }, cause })
        })
      )
      yield* remove(from)
      return renamed
    }, Semaphore.withPermit(changes)),
    delete: Effect.fn("LocalDefaultTraitCollection.delete")(remove, Semaphore.withPermit(changes))
  })
}).pipe(Layer.effect(DefaultTraitCollection))
