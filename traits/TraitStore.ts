import { eq, inArray, notInArray } from "drizzle-orm"
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core"
import {
  Array,
  Cause,
  Context,
  Crypto,
  Effect,
  FileSystem,
  flow,
  Layer,
  Path,
  pipe,
  PlatformError,
  Predicate,
  Schema as S,
  Semaphore,
  String
} from "effect"
import { Hex } from "effect/encoding"
import type { SqlError } from "effect/sql"

import { ProjectPaths } from "./ProjectPaths.ts"
import { T } from "./tables/index.ts"
import * as Trait from "./Trait.ts"
import * as TraitDatabase from "./TraitDatabase.ts"

export class TraitParseError extends S.TaggedError<TraitParseError>()("TraitParseError", {
  path: S.String,
  cause: S.Defect()
}) {
  override get message() {
    const diagnosis = S.isSchemaError(this.cause)
      ? "The document does not match the installed Trait schema. This may be a legacy format or invalid field values; inspect it before deciding migration is appropriate."
      : "The document could not be parsed. Inspect the original diagnostic for malformed YAML or missing/unterminated frontmatter; do not assume this is a schema migration."
    return String.stripMargin(`
    | Unable to parse trait ${this.path}.
    | ${Cause.pretty(Cause.fail(this.cause))}
    |
    | ${diagnosis}
    | Recovery requires developer consent. Ask the developer: "May I automatically resolve the stored-trait parse errors and retry the blocked operation?"
    | Do not change files before approval. Do not merely report the blocker and stop without offering this recovery choice. If declined, leave files unchanged and report the operation as incomplete.
    | After approval, inspect the entire affected trait store, not just the first failing file. Classify each failure and migrate repairable legacy formats to the installed Trait schema; repair malformed documents only where the intended content is clear.
    | Preserve names, authoritative requirements, applicability, exceptions, examples, and all other supporting context. If a repair is ambiguous or unsupported, ask a focused question rather than guessing, inventing intent, or dropping information. Leave already-valid traits unchanged.
    | The current format requires name, subject, requirement, and purpose in YAML frontmatter; applicability is optional text, and the Markdown body is optional context. Advisory guidance belongs in context; move legacy guidance there only after migration approval. Purpose explains intended benefit, not additional obligations. Legacy body requirements belong in requirement; when/mime/skip become applicability prose; diffs and additional information belong in context.
    | Validate all files in the affected store with the installed Trait schema and serialize format before retrying the originally blocked operation with its original arguments. A server restart is not necessary: repaired files are read on retry.
    | No automatic migration has occurred. The original operation failed; do not treat it as successful or claim a completed check until the retry succeeds.
    `)
  }
}

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
  S.Struct({ ...TraitParseError.fields, message: S.String }),
  S.TaggedStruct("PlatformError", { message: S.String }),
  S.TaggedStruct("SqlError", { message: S.String }),
  S.TaggedStruct("EffectDrizzleQueryError", { message: S.String })
])

export class TraitStore extends Context.Service<
  TraitStore,
  {
    readonly add: (
      trait: Trait.Trait
    ) => Effect.Effect<
      Trait.Trait,
      | PlatformError.PlatformError
      | TraitAlreadyExistsError
      | TraitParseError
      | TraitFilenameMismatchError
      | EffectDrizzleQueryError
    >
    readonly update: (
      trait: Trait.Trait
    ) => Effect.Effect<
      void,
      | PlatformError.PlatformError
      | TraitParseError
      | TraitNotFoundError
      | TraitFilenameMismatchError
      | EffectDrizzleQueryError
    >
    readonly get: (
      name: Trait.TraitName
    ) => Effect.Effect<
      Trait.Trait,
      | PlatformError.PlatformError
      | TraitParseError
      | TraitNotFoundError
      | TraitFilenameMismatchError
      | EffectDrizzleQueryError
    >
    readonly ls: Effect.Effect<
      ReadonlyArray<Trait.Trait>,
      | PlatformError.PlatformError
      | TraitParseError
      | TraitFilenameMismatchError
      | SqlError.SqlError
      | EffectDrizzleQueryError
    >
    readonly rm: (
      names: ReadonlyArray<Trait.TraitName>
    ) => Effect.Effect<
      void,
      | PlatformError.PlatformError
      | TraitParseError
      | TraitNotFoundError
      | TraitFilenameMismatchError
      | EffectDrizzleQueryError
    >
  }
>()("traits/TraitStore") {}

const readFile = Effect.fn("TraitStore.readFile")(function* (file: string, content?: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const text = content ?? (yield* fs.readFileString(file))
  return yield* Trait.parse(text, file).pipe(
    Effect.mapError((cause) => TraitParseError.make({ path: file, cause })),
    Effect.filterOrFail(
      (trait) => `${trait.name}.md` === path.basename(file),
      (trait) => TraitFilenameMismatchError.make({ path: file, expectedFilename: `${trait.name}.md` })
    )
  )
})

const makeFileSystem = Effect.gen(function* () {
  const { traitsDirectory } = yield* ProjectPaths
  const services = yield* Effect.context<FileSystem.FileSystem | Path.Path>()
  const read = flow(readFile, Effect.provideContext(services))
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const root = traitsDirectory
  yield* fs.makeDirectory(root, { recursive: true })

  const traitPath = (name: Trait.TraitName) => path.join(root, `${name}.md`)
  const get = Effect.fn("TraitStore.get")((name: Trait.TraitName) =>
    pipe(
      name,
      traitPath,
      read,
      Effect.catchTags({
        PlatformError: (error) => (error.reason._tag === "NotFound" ? TraitNotFoundError.make({ name }) : error)
      })
    )
  )

  return {
    add: Effect.fn("TraitStore.add")(function* (trait) {
      const directory = yield* fs.makeTempDirectoryScoped({ directory: root, prefix: ".traits-write-" })
      const temporary = path.join(directory, `${trait.name}.md`)
      yield* fs.writeFileString(temporary, Trait.serialize(trait))
      yield* fs.link(temporary, traitPath(trait.name)).pipe(
        Effect.catchTags({
          PlatformError: (error) =>
            error.reason._tag === "AlreadyExists" ? TraitAlreadyExistsError.make({ name: trait.name }) : error
        })
      )
      return trait
    }, Effect.scoped),
    get,
    update: Effect.fn("TraitStore.update")(function* (trait) {
      yield* get(trait.name)
      const info = yield* fs.stat(traitPath(trait.name))
      const directory = yield* fs.makeTempDirectoryScoped({ directory: root, prefix: ".traits-write-" })
      const temporary = path.join(directory, `${trait.name}.md`)
      yield* fs.writeFileString(temporary, Trait.serialize(trait), { mode: info.mode })
      yield* fs.rename(temporary, traitPath(trait.name))
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
            return yield* read(file)
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
  } satisfies TraitStore["Service"]
}).pipe(Effect.withSpan("TraitStore.open"))

export const layerFileSystem = Layer.effect(TraitStore, makeFileSystem)

/** Markdown remains authoritative; the database caches validated complete traits. */
export const layerLibsql = Layer.effect(
  TraitStore,
  Effect.gen(function* () {
    const filesystem = yield* makeFileSystem
    const { traitsDirectory } = yield* ProjectPaths
    const services = yield* Effect.context<FileSystem.FileSystem | Path.Path>()
    const read = flow(readFile, Effect.provideContext(services))
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const db = yield* TraitDatabase.TraitDatabase
    const crypto = yield* Crypto.Crypto
    const root = traitsDirectory
    const semaphore = yield* Semaphore.make(1)
    const table = T.traits

    const synchronize = Effect.fn("TraitStore.synchronize")(function* (
      file: string,
      cached?: T.traits["$inferSelect"]
    ) {
      const info = yield* fs.stat(file)
      if (info.type !== "File") return undefined
      const content = yield* fs.readFileString(file)
      const fingerprint = yield* crypto
        .digest("SHA-256", new TextEncoder().encode(content))
        .pipe(Effect.map(Hex.encode))
      if (cached?.fingerprint === fingerprint) {
        return Trait.Trait.make({
          name: Trait.TraitName.make(cached.name),
          subject: cached.subject,
          requirement: cached.requirement,
          ...(cached.applicability === null ? {} : { applicability: cached.applicability }),
          purpose: cached.purpose,
          ...(cached.context === null ? {} : { context: cached.context })
        })
      }
      const document = yield* read(file, content)
      const values = {
        ...document,
        applicability: document.applicability ?? null,
        context: document.context ?? null,
        fingerprint
      }
      yield* db.insert(table).values(values).onConflictDoUpdate({
        target: table.name,
        set: values
      })
      return document
    })

    const get = Effect.fn("TraitStore.getIndexed")(function* (name: Trait.TraitName) {
      const cached = yield* db.select().from(table).where(eq(table.name, name))
      const document = yield* synchronize(path.join(root, `${name}.md`), cached[0]).pipe(
        Effect.catchTags({
          PlatformError: (error) =>
            error.reason._tag === "NotFound"
              ? db
                  .delete(table)
                  .where(eq(table.name, name))
                  .pipe(Effect.andThen(TraitNotFoundError.make({ name })))
              : error
        })
      )
      return document === undefined ? yield* filesystem.get(name) : document
    })

    const store = TraitStore.of({
      get: flow(get, semaphore.withPermits(1)),
      ls: Effect.gen(function* () {
        const entries = yield* fs.readDirectory(root)
        const cached = yield* db
          .select()
          .from(table)
          .pipe(
            Effect.map(
              flow(
                Array.map((row) => [row.name, row] as const),
                (entries) => new Map(entries)
              )
            )
          )
        const documents = yield* pipe(
          entries,
          Array.filter(String.endsWith(".md")),
          Array.sort(String.Order),
          Effect.forEach((entry) => synchronize(path.join(root, entry), cached.get(path.basename(entry, ".md")))),
          Effect.map(Array.filter(Predicate.isNotUndefined))
        )
        const names = Array.map(documents, (document) => document.name)
        yield* db.delete(table).where(notInArray(table.name, names))
        return documents
      }).pipe(db.$client.withTransaction, semaphore.withPermits(1), Effect.withSpan("TraitStore.lsIndexed")),
      add: Effect.fn("TraitStore.addIndexed")(
        function* (trait) {
          yield* filesystem.add(trait)
          yield* db.delete(table).where(eq(table.name, trait.name))
          yield* synchronize(path.join(root, `${trait.name}.md`))
          return trait
        },
        Effect.uninterruptible,
        semaphore.withPermits(1)
      ),
      update: Effect.fn("TraitStore.updateIndexed")(
        function* (trait) {
          yield* db.delete(table).where(eq(table.name, trait.name))
          yield* filesystem.update(trait)
          yield* synchronize(path.join(root, `${trait.name}.md`))
        },
        Effect.uninterruptible,
        semaphore.withPermits(1)
      ),
      rm: Effect.fn("TraitStore.rmIndexed")(
        function* (names) {
          yield* db.delete(table).where(inArray(table.name, names))
          yield* filesystem.rm(names)
        },
        Effect.uninterruptible,
        semaphore.withPermits(1)
      )
    })
    // Keep malformed files recoverable through the tools after startup indexing fails.
    yield* store.ls.pipe(
      Effect.catchTags({
        TraitParseError: (error) => Effect.logWarning(error.message),
        TraitFilenameMismatchError: (error) => Effect.logWarning(error.message)
      })
    )
    return store
  })
)
