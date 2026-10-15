import {
  Array,
  Context,
  Effect,
  FileSystem,
  flow,
  Layer,
  Path,
  pipe,
  PlatformError,
  Predicate,
  Record,
  Schema as S,
  String
} from "effect"

import * as Trait from "./Trait.ts"

export class TraitNotFoundError extends S.TaggedError<TraitNotFoundError>()("TraitNotFoundError", {
  id: Trait.TraitId,
  message: S.String
}) {}

export class TraitAlreadyExistsError extends S.TaggedError<TraitAlreadyExistsError>()("TraitAlreadyExistsError", {
  id: Trait.TraitId,
  message: S.String
}) {}

export class DuplicateTraitIdError extends S.TaggedError<DuplicateTraitIdError>()("DuplicateTraitIdError", {
  id: Trait.TraitId,
  paths: S.Array(S.String),
  message: S.String
}) {}

export class TraitFilenameMismatchError extends S.TaggedError<TraitFilenameMismatchError>()(
  "TraitFilenameMismatchError",
  {
    path: S.String,
    expectedFilename: S.String,
    message: S.String
  }
) {}

export type Error =
  | PlatformError.PlatformError
  | S.SchemaError
  | Trait.ParseError
  | TraitNotFoundError
  | TraitAlreadyExistsError
  | DuplicateTraitIdError
  | TraitFilenameMismatchError
export const TraitStoreError = S.Union([
  TraitNotFoundError,
  TraitAlreadyExistsError,
  DuplicateTraitIdError,
  TraitFilenameMismatchError,
  Trait.ParseError,
  S.TaggedStruct("PlatformError", { message: S.String }),
  S.TaggedStruct("SchemaError", { message: S.String })
])

export class TraitStore extends Context.Service<
  TraitStore,
  {
    readonly add: (trait: Trait.Trait) => Effect.Effect<Trait.Trait, Error>
    readonly update: (trait: Trait.Trait) => Effect.Effect<void, Error>
    readonly get: (id: Trait.TraitId) => Effect.Effect<Trait.Trait, Error>
    readonly ls: Effect.Effect<ReadonlyArray<Trait.Trait>, Error>
    readonly rm: (ids: ReadonlyArray<Trait.TraitId>) => Effect.Effect<void, Error>
  }
>()("traits/TraitStore") {}

export const layerFileSystem = (dir: string) =>
  Layer.effect(
    TraitStore,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = path.resolve(dir)
      yield* fs.makeDirectory(root, { recursive: true })

      const traitPath = (trait: Trait.Trait) => path.join(root, `${trait.name}-${trait.id}.md`)
      const pathsForId = Effect.fn("TraitStore.pathsForId")(function* (id: Trait.TraitId) {
        const names = yield* fs.readDirectory(root)
        return yield* pipe(
          names,
          Array.filter(String.endsWith(`-${id}.md`)),
          Array.map((name) => path.join(root, name)),
          Array.sort(String.Order),
          Effect.filter(
            flow(
              fs.stat,
              Effect.map((info) => info.type === "File")
            ),
            { concurrency: "unbounded" }
          )
        )
      })
      const findPath = (id: Trait.TraitId) =>
        pathsForId(id).pipe(
          Effect.filterOrFail(
            (files) => files.length === 1,
            (files) =>
              files.length === 0
                ? TraitNotFoundError.make({ id, message: `Trait ${id} was not found` })
                : DuplicateTraitIdError.make({ id, paths: files, message: `Multiple files claim trait ID ${id}` })
          ),
          Effect.map(Array.getUnsafe(0))
        )
      const readFile = Effect.fn("TraitStore.readFile")(function* (file: string) {
        const text = yield* fs.readFileString(file)
        return yield* Trait.parse(text, file).pipe(
          Effect.filterOrFail(
            (trait) => traitPath(trait) === file,
            (trait) =>
              TraitFilenameMismatchError.make({
                path: file,
                expectedFilename: `${trait.name}-${trait.id}.md`,
                message: `Trait filename must be ${trait.name}-${trait.id}.md, received ${path.basename(file)}`
              })
          )
        )
      })

      return TraitStore.of({
        add: Effect.fn("TraitStore.add")(function* (trait) {
          yield* pathsForId(trait.id).pipe(
            Effect.filterOrFail(
              (files) => files.length === 0,
              () =>
                TraitAlreadyExistsError.make({
                  id: trait.id,
                  message: `Trait ID ${trait.id} already exists`
                })
            )
          )
          yield* fs.writeFileString(traitPath(trait), Trait.serialize(trait), { flag: "wx" })
          return trait
        }),
        get: Effect.fn("TraitStore.get")(function* (id) {
          const file = yield* findPath(id)
          return yield* readFile(file)
        }),
        update: Effect.fn("TraitStore.update")(function* (trait) {
          const source = yield* findPath(trait.id)
          yield* readFile(source)
          const text = Trait.serialize(trait)
          const destination = traitPath(trait)
          if (source !== destination) {
            yield* fs.writeFileString(destination, text, { flag: "wx" })
            yield* fs.remove(source)
            return
          }
          const file = yield* fs.open(source, { flag: "r+" })
          yield* file.truncate(0)
          yield* file.writeAll(new TextEncoder().encode(text))
        }, Effect.scoped),
        ls: Effect.gen(function* () {
          const names = yield* fs.readDirectory(root)
          return yield* pipe(
            names,
            Array.sort(String.Order),
            Array.filter(String.endsWith(".md")),
            Effect.forEach(
              Effect.fn("TraitStore.readEntry")(function* (name) {
                const file = path.join(root, name)
                const info = yield* fs.stat(file)
                if (info.type !== "File") return undefined
                return yield* readFile(file)
              }),
              { concurrency: 1 }
            ),
            Effect.map(Array.filter(Predicate.isNotUndefined))
          )
        }).pipe(
          Effect.filterOrFail(
            (traits) => Array.dedupeWith(traits, (left, right) => left.id === right.id).length === traits.length,
            (traits) => {
              const duplicates = pipe(
                traits,
                Array.groupBy((trait) => trait.id),
                Record.values,
                Array.filter((group) => group.length > 1),
                Array.getUnsafe(0)
              )
              const id = Array.getUnsafe(duplicates, 0).id
              return DuplicateTraitIdError.make({
                id,
                paths: Array.map(duplicates, traitPath),
                message: `Multiple files claim trait ID ${id}`
              })
            }
          ),
          Effect.withSpan("TraitStore.ls")
        ),
        rm: Effect.forEach(flow(findPath, Effect.flatMap(fs.remove)), { discard: true })
      })
    }).pipe(Effect.withSpan("TraitStore.open"))
  )
