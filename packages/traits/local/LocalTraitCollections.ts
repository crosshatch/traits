import { Array, Effect, Equal, FileSystem, Layer, Path, pipe, Record, Schema as S, Semaphore } from "effect"
import { Digest } from "effect/crypto"
import { ChildProcessSpawner } from "effect/process"

import { StorageError } from "../StorageError.ts"
import * as TraitCollections from "../TraitCollection/TraitCollections.ts"
import { TraitSource } from "../TraitCollection/TraitSource.ts"
import { TraitSourceId } from "../TraitCollection/TraitSourceId.ts"
import { writeFile } from "../util/fs/writeFile.ts"
import * as LocalGitTraitSource from "./LocalGitTraitSource.ts"
import * as LocalJsonFile from "./LocalJsonFile.ts"
import { LocalPaths } from "./LocalPaths.ts"
import * as LocalTraitCollection from "./LocalTraitCollection.ts"
import * as LocalTraitFile from "./LocalTraitFile.ts"
import * as TraitsConfig from "./TraitsConfig/TraitsConfig.ts"

/** The contents of traits/sources.lock.json: what each source's collection was last updated to, by the source's ID. */
const LockFile = S.Record(
  TraitSourceId,
  S.Struct({
    /** The source's declaration when its collection was last updated. */
    source: TraitSource,
    /** The commit the collection was taken from, for a Git source. */
    revision: S.String.pipe(S.optionalKey),
    /** A hash of the collection's trait files, which detects later changes to them. */
    hash: S.String
  })
)

/** Keeps each source's traits as plain files in traits/<id>/, meant to be committed, so checks need no network. Sources are declared under sources in traits/config.json, and traits/sources.lock.json records what each collection was last updated to. */
export const layer = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const paths = yield* LocalPaths
  const services = yield* Effect.context<
    FileSystem.FileSystem | Path.Path | Digest.Digest | ChildProcessSpawner.ChildProcessSpawner | LocalPaths
  >()
  // An update replaces a collection's files and rewrites the lock file, so updates run one at a time.
  const updates = yield* Semaphore.make(1)

  const sources = TraitsConfig.load.pipe(
    Effect.map((config) => config.sources),
    Effect.provide(services)
  )

  const lock = LocalJsonFile.read(paths.sourcesLock, LockFile).pipe(
    // Nothing has been updated yet until the first update writes the file.
    Effect.catchReason("StorageError", "Missing", () => Effect.succeed<typeof LockFile.Type>({}))
  )

  const update = Effect.fn("LocalTraitCollections.update")(
    function* (id: TraitSourceId, source: TraitSource) {
      const from =
        "git" in source
          ? yield* LocalGitTraitSource.checkout(id, source)
          : { directory: path.resolve(paths.root, source.directory), revision: undefined }
      const files = yield* LocalTraitFile.ls(from.directory).pipe(
        Effect.mapError((cause) =>
          TraitCollections.TraitCollectionUpdateError.make({
            traitSourceId: id,
            problem: "The source has no readable directory of traits.",
            cause
          })
        )
      )
      if (!Array.isReadonlyArrayNonEmpty(files)) {
        return yield* TraitCollections.TraitCollectionUpdateError.make({
          traitSourceId: id,
          problem: "The source's directory of traits holds no trait files."
        })
      }
      // Every file is validated before anything is replaced, so a failed update leaves the collection as it was.
      yield* Effect.forEach(
        files,
        (file) =>
          LocalTraitFile.parse(file).pipe(
            Effect.mapError((cause) =>
              TraitCollections.TraitCollectionUpdateError.make({
                traitSourceId: id,
                problem: `Could not take ${LocalTraitFile.fileName(file.name)} from the source: ${cause.message}`,
                cause
              })
            )
          ),
        { concurrency: 1, discard: true }
      )
      const directory = path.join(paths.directory, id)
      const previous = yield* LocalTraitFile.ls(directory).pipe(
        Effect.catchReason(
          "PlatformError",
          "NotFound",
          () => Effect.succeed(Array.empty<LocalTraitFile.LocalTraitFile>()),
          (_, cause) => StorageError.make({ location: directory, reason: { _tag: "Unreadable" }, cause })
        )
      )
      const before = new Map(Array.map(previous, (file) => [file.name, LocalTraitFile.normalizedText(file)]))
      const after = new Set(Array.map(files, ({ name }) => name))
      const added = Array.filter(files, ({ name }) => !before.has(name))
      const changed = Array.filter(
        files,
        (file) => before.has(file.name) && before.get(file.name) !== LocalTraitFile.normalizedText(file)
      )
      const removed = pipe(
        previous,
        Array.filter(({ name }) => !after.has(name)),
        Array.map(({ name }) => name)
      )
      yield* Effect.gen(function* () {
        yield* fs.makeDirectory(directory, { recursive: true })
        // Each file is replaced in one step, so another process never reads one that is missing or half-written. A file the source left as it was is not written again, which keeps an update quick and the file's line endings as Git checked them out.
        yield* Effect.forEach(
          [...added, ...changed],
          ({ name, text }) => writeFile(path.join(directory, LocalTraitFile.fileName(name)), text),
          // A write mostly waits for the disk, so a few at once finish somewhat sooner than one after another.
          { concurrency: 8, discard: true }
        )
        // Only the trait files the source no longer has are removed, so anything else in a directory that shares the source's ID is left alone.
        yield* Effect.forEach(removed, (name) => fs.remove(path.join(directory, LocalTraitFile.fileName(name))), {
          concurrency: 1,
          discard: true
        })
      }).pipe(
        Effect.mapError((cause) => StorageError.make({ location: directory, reason: { _tag: "Unwritable" }, cause }))
      )
      const hash = yield* LocalTraitFile.hash(files)
      const locked = yield* lock
      const entry = { source, ...(from.revision === undefined ? {} : { revision: from.revision }), hash }
      yield* LocalJsonFile.write(paths.sourcesLock, Record.set(locked, id, entry))

      return TraitCollections.TraitCollectionChanges.make({
        added: Array.map(added, ({ name }) => name),
        changed: Array.map(changed, ({ name }) => name),
        removed
      })
    },
    Effect.scoped,
    Effect.provide(services),
    Semaphore.withPermit(updates)
  )

  return TraitCollections.TraitCollections.of({
    sources: sources.pipe(Effect.withSpan("LocalTraitCollections.sources")),
    get: Effect.fn("LocalTraitCollections.get")(function* (id) {
      const declared = yield* sources
      const source = declared[id]
      if (source === undefined) {
        return yield* TraitCollections.TraitCollectionNotFoundError.make({ traitSourceId: id })
      }
      const directory = path.join(paths.directory, id)
      const locked = yield* lock
      const entry = locked[id]
      if (entry === undefined || !Equal.equals(entry.source, source)) {
        return yield* StorageError.make({ location: directory, reason: { _tag: "NotUpdated" } })
      }
      const files = yield* LocalTraitFile.ls(directory).pipe(
        Effect.catchReason(
          "PlatformError",
          "NotFound",
          () => StorageError.make({ location: directory, reason: { _tag: "NotUpdated" } }),
          (_, cause) => StorageError.make({ location: directory, reason: { _tag: "Unreadable" }, cause })
        )
      )
      const hash = yield* LocalTraitFile.hash(files)
      if (hash !== entry.hash) {
        return yield* StorageError.make({ location: directory, reason: { _tag: "Modified" } })
      }
      return yield* LocalTraitCollection.get(directory)
    }, Effect.provide(services)),
    update: Effect.fnUntraced(function* (id) {
      const declared = yield* sources
      const source = declared[id]
      if (source === undefined) {
        return yield* TraitCollections.TraitCollectionNotFoundError.make({ traitSourceId: id })
      }
      return yield* update(id, source)
    }),
    updateAll: Effect.gen(function* () {
      const declared = yield* sources
      const changes = yield* Effect.forEach(
        Record.toEntries(declared),
        ([id, source]) => update(id, source).pipe(Effect.map((changes) => [id, changes] as const)),
        { concurrency: 1 }
      )
      return Record.fromEntries(changes)
    }).pipe(Effect.withSpan("LocalTraitCollections.updateAll"))
  })
}).pipe(Layer.effect(TraitCollections.TraitCollections))
