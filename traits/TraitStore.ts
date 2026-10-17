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

import * as Frontmatter from "./_util/Frontmatter.ts"
import * as Trait from "./Trait.ts"

export class TraitNotFoundError extends S.TaggedError<TraitNotFoundError>()("TraitNotFoundError", {
  name: Trait.TraitName
}) {
  override get message() {
    return `Trait ${this.name} was not found`
  }
}

export class TraitAlreadyExistsError extends S.TaggedError<TraitAlreadyExistsError>()("TraitAlreadyExistsError", {
  name: Trait.TraitName
}) {
  override get message() {
    return `Trait ${this.name} already exists`
  }
}

export class TraitFilenameMismatchError extends S.TaggedError<TraitFilenameMismatchError>()(
  "TraitFilenameMismatchError",
  { path: S.String, expectedFilename: S.String }
) {
  override get message() {
    return `Trait filename must be ${this.expectedFilename}, received ${this.path}`
  }
}

export const TraitStoreError = S.Union([
  S.Struct({ ...TraitNotFoundError.fields, message: S.String }),
  S.Struct({ ...TraitAlreadyExistsError.fields, message: S.String }),
  S.Struct({ ...TraitFilenameMismatchError.fields, message: S.String }),
  S.Struct({ ...Frontmatter.MissingFrontmatterError.fields, message: S.String }),
  S.Struct({ ...Frontmatter.UnterminatedFrontmatterError.fields, message: S.String }),
  S.Struct({ ...Frontmatter.InvalidYamlError.fields, message: S.String }),
  S.TaggedStruct("PlatformError", { message: S.String }),
  S.TaggedStruct("SchemaError", { message: S.String })
])

export class TraitStore extends Context.Service<
  TraitStore,
  {
    readonly add: (
      trait: Trait.Trait
    ) => Effect.Effect<Trait.Trait, PlatformError.PlatformError | TraitAlreadyExistsError>
    readonly update: (
      trait: Trait.Trait
    ) => Effect.Effect<
      void,
      | PlatformError.PlatformError
      | S.SchemaError
      | Frontmatter.ParseError
      | TraitNotFoundError
      | TraitFilenameMismatchError
    >
    readonly get: (
      name: Trait.TraitName
    ) => Effect.Effect<
      Trait.Trait,
      | PlatformError.PlatformError
      | S.SchemaError
      | Frontmatter.ParseError
      | TraitNotFoundError
      | TraitFilenameMismatchError
    >
    readonly ls: Effect.Effect<
      ReadonlyArray<Trait.Trait>,
      PlatformError.PlatformError | S.SchemaError | Frontmatter.ParseError | TraitFilenameMismatchError
    >
    readonly rm: (
      names: ReadonlyArray<Trait.TraitName>
    ) => Effect.Effect<
      void,
      | PlatformError.PlatformError
      | S.SchemaError
      | Frontmatter.ParseError
      | TraitNotFoundError
      | TraitFilenameMismatchError
    >
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

      const traitPath = (name: Trait.TraitName) => path.join(root, `${name}.md`)
      const readFile = Effect.fn("TraitStore.readFile")(function* (file: string) {
        const text = yield* fs.readFileString(file)
        return yield* Trait.parse(text, file).pipe(
          Effect.filterOrFail(
            (trait) => traitPath(trait.name) === file,
            (trait) => TraitFilenameMismatchError.make({ path: file, expectedFilename: `${trait.name}.md` })
          )
        )
      })
      const get = Effect.fn("TraitStore.get")((name: Trait.TraitName) =>
        readFile(traitPath(name)).pipe(
          Effect.catchTags({
            PlatformError: (error) =>
              error.reason._tag === "NotFound" ? TraitNotFoundError.make({ name }) : Effect.fail(error)
          })
        )
      )

      return TraitStore.of({
        add: Effect.fn("TraitStore.add")(function* (trait) {
          yield* fs.writeFileString(traitPath(trait.name), Trait.serialize(trait), { flag: "wx" }).pipe(
            Effect.catchTags({
              PlatformError: (error) =>
                error.reason._tag === "AlreadyExists"
                  ? TraitAlreadyExistsError.make({ name: trait.name })
                  : Effect.fail(error)
            })
          )
          return trait
        }),
        get,
        update: Effect.fn("TraitStore.update")(function* (trait) {
          yield* get(trait.name)
          const file = yield* fs.open(traitPath(trait.name), { flag: "r+" })
          yield* file.truncate(0)
          yield* file.writeAll(new TextEncoder().encode(Trait.serialize(trait)))
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
        }).pipe(Effect.withSpan("TraitStore.ls")),
        rm: Effect.forEach(
          flow(
            get,
            Effect.flatMap((trait) => fs.remove(traitPath(trait.name)))
          ),
          { discard: true }
        )
      })
    }).pipe(Effect.withSpan("TraitStore.open"))
  )
