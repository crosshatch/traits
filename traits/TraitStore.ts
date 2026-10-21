import { eq, inArray } from "drizzle-orm"
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core"
import {
  Array,
  Cause,
  Context,
  Deferred,
  Effect,
  FileSystem,
  flow,
  Layer,
  Path,
  pipe,
  PlatformError,
  Predicate,
  Schema as S,
  Schedule,
  Semaphore,
  Stream,
  String
} from "effect"
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
    | Validate all files in the affected store with the installed Trait schema and serialize format, then retry the originally blocked operation with its original arguments. Synchronization after repairs is automatic. A server restart is not necessary.
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
      | SqlError.SqlError
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
      | SqlError.SqlError
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
      | SqlError.SqlError
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
      | SqlError.SqlError
      | TraitFilenameMismatchError
      | EffectDrizzleQueryError
    >
    readonly refresh: Effect.Effect<
      void,
      | PlatformError.PlatformError
      | TraitParseError
      | TraitFilenameMismatchError
      | SqlError.SqlError
      | EffectDrizzleQueryError
    >
  }
>()("traits/TraitStore") {}

const readFile = Effect.fn("TraitStore.readFile")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const text = yield* fs.readFileString(file)
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

  const ls = Effect.gen(function* () {
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
  }).pipe(Effect.withSpan("TraitStore.ls"))

  return {
    refresh: ls.pipe(Effect.asVoid),
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
    ls,
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

/** Keep SQLite synchronized with Markdown; ordinary reads query SQLite while the index is clean. */
export const layerLibsql = Layer.effect(
  TraitStore,
  Effect.gen(function* () {
    const filesystem = yield* makeFileSystem
    const db = yield* TraitDatabase.TraitDatabase
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const { traitsDirectory } = yield* ProjectPaths
    const semaphore = yield* Semaphore.make(1)
    const table = T.traits
    let revision = 0
    let indexedRevision = -1
    let watcherFailure: PlatformError.PlatformError | undefined
    const invalidate = Effect.sync(() => {
      revision++
    })
    const values = (trait: Trait.Trait) => ({
      ...trait,
      applicability: trait.applicability ?? null,
      context: trait.context ?? null
    })
    const fromRow = (row: T.traits["$inferSelect"]) =>
      Trait.Trait.make({
        name: Trait.TraitName.make(row.name),
        subject: row.subject,
        requirement: row.requirement,
        ...(row.applicability === null ? {} : { applicability: row.applicability }),
        purpose: row.purpose,
        ...(row.context === null ? {} : { context: row.context })
      })

    const rebuild = Effect.gen(function* () {
      const currentRevision = revision
      const documents = yield* filesystem.ls
      yield* Effect.gen(function* () {
        yield* db.delete(table)
        yield* Effect.forEach(
          Array.chunksOf(documents, 100),
          (batch) => db.insert(table).values(Array.map(batch, values)),
          { discard: true }
        )
      }).pipe(db.$client.withTransaction)
      indexedRevision = currentRevision
    }).pipe(Effect.withSpan("TraitStore.rebuild"))
    const ready = Effect.gen(function* () {
      if (watcherFailure !== undefined) return yield* watcherFailure
      while (indexedRevision !== revision) yield* rebuild
    })
    const refresh = invalidate.pipe(
      Effect.andThen(ready),
      Effect.uninterruptible,
      semaphore.withPermits(1),
      Effect.withSpan("TraitStore.refresh")
    )
    const synchronize = ready.pipe(
      semaphore.withPermits(1),
      Effect.catchCause((cause) => (Cause.hasInterruptsOnly(cause) ? Effect.interrupt : Effect.logWarning(cause)))
    )

    const get = Effect.fn("TraitStore.getIndexed")(function* (name: Trait.TraitName) {
      yield* ready
      const rows = yield* db.select().from(table).where(eq(table.name, name))
      const row = rows[0]
      return row === undefined ? yield* TraitNotFoundError.make({ name }) : fromRow(row)
    })

    const store = TraitStore.of({
      refresh,
      get: flow(get, semaphore.withPermits(1)),
      ls: Effect.gen(function* () {
        yield* ready
        return yield* db
          .select()
          .from(table)
          .orderBy(table.name)
          .pipe(Effect.map(Array.map(fromRow)))
      }).pipe(semaphore.withPermits(1), Effect.withSpan("TraitStore.lsIndexed")),
      add: Effect.fn("TraitStore.addIndexed")(
        function* (trait) {
          yield* ready
          const existing = yield* db.select({ name: table.name }).from(table).where(eq(table.name, trait.name))
          if (existing.length > 0) return yield* TraitAlreadyExistsError.make({ name: trait.name })
          yield* filesystem.add(trait).pipe(Effect.tapCause(() => invalidate))
          yield* db
            .insert(table)
            .values(values(trait))
            .pipe(Effect.tapCause(() => invalidate))
          return trait
        },
        Effect.uninterruptible,
        semaphore.withPermits(1)
      ),
      update: Effect.fn("TraitStore.updateIndexed")(
        function* (trait) {
          yield* get(trait.name)
          yield* filesystem.update(trait).pipe(Effect.tapCause(() => invalidate))
          yield* db
            .update(table)
            .set(values(trait))
            .where(eq(table.name, trait.name))
            .pipe(Effect.tapCause(() => invalidate))
        },
        Effect.uninterruptible,
        semaphore.withPermits(1)
      ),
      rm: Effect.fn("TraitStore.rmIndexed")(
        function* (names) {
          yield* ready
          yield* Effect.forEach(names, get, { discard: true })
          yield* filesystem.rm(names).pipe(Effect.tapCause(() => invalidate))
          yield* db
            .delete(table)
            .where(inArray(table.name, names))
            .pipe(Effect.tapCause(() => invalidate))
        },
        Effect.uninterruptible,
        semaphore.withPermits(1)
      )
    })
    const started = yield* Deferred.make<void>()
    yield* Effect.gen(function* () {
      yield* fs.makeDirectory(traitsDirectory, { recursive: true })
      // Materialize the watch before scanning; callback registration runs in a child fiber.
      const pull = yield* Stream.toPull(fs.watch(traitsDirectory))
      yield* Effect.yieldNow
      watcherFailure = undefined
      yield* synchronize
      yield* Deferred.succeed(started, undefined)
      yield* Stream.fromPull(Effect.succeed(pull)).pipe(
        Stream.filter((event) => {
          const file = path.resolve(traitsDirectory, event.path)
          return path.dirname(file) === traitsDirectory && path.extname(file) === ".md"
        }),
        Stream.tap(() => invalidate),
        Stream.debounce("50 millis"),
        Stream.runForEach(() => synchronize)
      )
      return yield* PlatformError.systemError({
        _tag: "Unknown",
        module: "FileSystem",
        method: "watch",
        pathOrDescriptor: traitsDirectory,
        cause: "The trait directory watch ended unexpectedly."
      })
    }).pipe(
      Effect.scoped,
      Effect.catchDefect((cause) =>
        PlatformError.systemError({
          _tag: "Unknown",
          module: "FileSystem",
          method: "watch",
          pathOrDescriptor: traitsDirectory,
          cause
        })
      ),
      Effect.tapError((error) =>
        Effect.gen(function* () {
          watcherFailure = error
          yield* invalidate
          yield* Effect.logWarning(error)
        })
      ),
      Effect.retry(Schedule.spaced("1 second")),
      Effect.forkScoped
    )
    yield* Deferred.await(started)
    return store
  })
)
