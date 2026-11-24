import { Effect, FileSystem, Path } from "effect"

import { StorageError } from "../StorageError.ts"
import { type TraitCollection, TraitNotFoundError } from "../TraitCollection/TraitCollection.ts"
import * as LocalTraitFile from "./LocalTraitFile.ts"

/** The collection of traits a directory holds as <name>.md files, read on each use. */
export const get = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  return {
    names: LocalTraitFile.names(directory).pipe(
      Effect.mapError((cause) => StorageError.make({ location: directory, reason: { _tag: "Unreadable" }, cause })),
      Effect.provideService(FileSystem.FileSystem, fs)
    ),
    get: Effect.fn("LocalTraitCollection.get")(function* (name) {
      const file = path.join(directory, LocalTraitFile.fileName(name))
      const text = yield* fs.readFileString(file).pipe(
        Effect.catchReason(
          "PlatformError",
          "NotFound",
          () => TraitNotFoundError.make({ traitName: name }),
          (_, cause) => StorageError.make({ location: file, reason: { _tag: "Unreadable" }, cause })
        )
      )
      return yield* LocalTraitFile.parse({ name, text }).pipe(
        Effect.mapError((cause) => StorageError.make({ location: file, reason: { _tag: "Malformed" }, cause }))
      )
    })
  } satisfies TraitCollection
})
