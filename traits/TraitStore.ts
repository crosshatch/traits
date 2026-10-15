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
  Schema as S,
  String
} from "effect"

import * as Trait from "./Trait.ts"

export const TraitStoreError = S.TaggedStruct("PlatformError", { message: S.String })

export class TraitStore extends Context.Service<
  TraitStore,
  {
    readonly add: (trait: Trait.Trait) => Effect.Effect<Trait.Trait, PlatformError.PlatformError>
    readonly update: (
      trait: Trait.Trait
    ) => Effect.Effect<void, PlatformError.PlatformError | Trait.TraitParseError | S.SchemaError>
    readonly get: (
      id: Trait.TraitId
    ) => Effect.Effect<Trait.Trait, PlatformError.PlatformError | Trait.TraitParseError | S.SchemaError>
    readonly ls: Effect.Effect<
      ReadonlyArray<Trait.Trait>,
      PlatformError.PlatformError | Trait.TraitParseError | S.SchemaError
    >
    readonly rm: (ids: ReadonlyArray<Trait.TraitId>) => Effect.Effect<void, PlatformError.PlatformError>
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
              PlatformError.systemError({
                _tag: files.length === 0 ? "NotFound" : "AlreadyExists",
                module: "FileSystem",
                method: "TraitStore.findPath",
                pathOrDescriptor: root,
                description: files.length === 0 ? `Trait ${id} was not found` : `Multiple files claim trait ID ${id}`
              })
          ),
          Effect.map(Array.getUnsafe(0))
        )
      const readFile = Effect.fn("TraitStore.readFile")(function* (file: string) {
        const text = yield* fs.readFileString(file)
        return yield* Trait.parse(text).pipe(
          Effect.filterOrFail(
            (trait) => traitPath(trait) === file,
            (trait) =>
              Trait.TraitParseError.make({
                reason: "FilenameMismatch",
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
                PlatformError.systemError({
                  _tag: "AlreadyExists",
                  module: "FileSystem",
                  method: "TraitStore.add",
                  pathOrDescriptor: root,
                  description: `Trait ID ${trait.id} already exists`
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
            () =>
              PlatformError.systemError({
                _tag: "AlreadyExists",
                module: "FileSystem",
                method: "TraitStore.ls",
                pathOrDescriptor: root,
                description: "Multiple files claim the same trait ID"
              })
          ),
          Effect.withSpan("TraitStore.ls")
        ),
        rm: Effect.forEach(flow(findPath, Effect.flatMap(fs.remove)), { discard: true })
      })
    }).pipe(Effect.withSpan("TraitStore.open"))
  )
