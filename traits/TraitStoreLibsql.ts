import { eq, inArray } from "drizzle-orm"
import {
  Array,
  Cause,
  Deferred,
  Effect,
  FileSystem,
  flow,
  Layer,
  Path,
  pipe,
  PlatformError,
  Predicate,
  Schedule,
  Schema as S,
  Semaphore,
  Stream,
  String
} from "effect"

import { ProjectPaths } from "./ProjectPaths.ts"
import { T } from "./tables/index.ts"
import * as Trait from "./Trait.ts"
import * as TraitDatabase from "./TraitDatabase.ts"
import * as TraitStore from "./TraitStore.ts"

const readFile = Effect.fn("TraitStore.readFile")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const text = yield* fs.readFileString(file)
  return yield* Trait.parse(text, file).pipe(
    Effect.mapError((cause) => TraitStore.TraitParseError.make({ path: file, cause })),
    Effect.filterOrFail(
      (trait) => `${trait.name}.md` === path.basename(file),
      (trait) => TraitStore.TraitFilenameMismatchError.make({ path: file, expectedFilename: `${trait.name}.md` })
    )
  )
})

/** Private Markdown persistence operations used by the indexed store. */
const markdown = Effect.gen(function* () {
  const { traitsDirectory } = yield* ProjectPaths
  const services = yield* Effect.context<FileSystem.FileSystem | Path.Path>()
  const read = flow(readFile, Effect.provideContext(services))
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  yield* fs.makeDirectory(traitsDirectory, { recursive: true })
  const traitPath = (name: Trait.TraitName) => path.join(traitsDirectory, `${name}.md`)
  const get = Effect.fn("TraitStore.readMarkdown")((name: Trait.TraitName) =>
    pipe(
      name,
      traitPath,
      read,
      Effect.catchTags({
        PlatformError: (error) =>
          error.reason._tag === "NotFound" ? TraitStore.TraitNotFoundError.make({ name }) : error
      })
    )
  )
  const ls = Effect.gen(function* () {
    const names = yield* fs.readDirectory(traitsDirectory)
    return yield* pipe(
      names,
      Array.sort(String.Order),
      Array.filter(String.endsWith(".md")),
      Effect.forEach(
        Effect.fn("TraitStore.readEntry")(function* (name) {
          const file = path.join(traitsDirectory, name)
          const info = yield* fs.stat(file)
          if (info.type !== "File") return undefined
          return yield* read(file)
        }),
        { concurrency: 1 }
      ),
      Effect.map(Array.filter(Predicate.isNotUndefined))
    )
  }).pipe(Effect.withSpan("TraitStore.scanMarkdown"))
  return {
    read,
    ls,
    add: Effect.fn("TraitStore.addMarkdown")(function* (trait: Trait.Trait) {
      const directory = yield* fs.makeTempDirectoryScoped({ directory: traitsDirectory, prefix: ".traits-write-" })
      const temporary = path.join(directory, `${trait.name}.md`)
      yield* fs.writeFileString(temporary, Trait.serialize(trait))
      yield* fs.link(temporary, traitPath(trait.name)).pipe(
        Effect.catchTags({
          PlatformError: (error) =>
            error.reason._tag === "AlreadyExists"
              ? TraitStore.TraitAlreadyExistsError.make({ name: trait.name })
              : error
        })
      )
    }, Effect.scoped),
    update: Effect.fn("TraitStore.updateMarkdown")(function* (trait: Trait.Trait) {
      yield* get(trait.name)
      const info = yield* fs.stat(traitPath(trait.name))
      const directory = yield* fs.makeTempDirectoryScoped({ directory: traitsDirectory, prefix: ".traits-write-" })
      const temporary = path.join(directory, `${trait.name}.md`)
      yield* fs.writeFileString(temporary, Trait.serialize(trait), { mode: info.mode })
      yield* fs.rename(temporary, traitPath(trait.name))
    }, Effect.scoped),
    rm: Effect.forEach(
      flow(
        get,
        Effect.flatMap((trait) => fs.remove(traitPath(trait.name)))
      ),
      { discard: true }
    )
  }
}).pipe(Effect.withSpan("TraitStore.open"))

/** Markdown is authoritative; watch notifications reconcile only affected files. */
export const layer = Layer.effect(
  TraitStore.TraitStore,
  Effect.gen(function* () {
    const filesystem = yield* markdown
    const db = yield* TraitDatabase.TraitDatabase
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const { traitsDirectory } = yield* ProjectPaths
    const semaphore = yield* Semaphore.make(1)
    const serialize = semaphore.withPermits(1)
    const table = T.traits
    const equivalent = S.toEquivalence(Trait.Trait)
    // Generations ensure events arriving during a scan or SQL transaction are not acknowledged early.
    let revision = 0
    let fullRevision = 0
    let indexedRevision = -1
    const dirty = new Map<string, number>()
    let watcherFailure: PlatformError.PlatformError | undefined
    const invalidate = Effect.sync(() => {
      fullRevision = ++revision
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
    const acknowledge = (snapshot: ReadonlyMap<string, number>) => {
      for (const [file, generation] of snapshot) if (dirty.get(file) === generation) dirty.delete(file)
    }
    const rebuild = Effect.gen(function* () {
      const currentRevision = fullRevision
      const snapshot = new Map(dirty)
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
      acknowledge(snapshot)
    }).pipe(Effect.withSpan("TraitStore.rebuild"))
    const reconcile = Effect.gen(function* () {
      const snapshot = new Map(dirty)
      // Validate the entire pending batch before touching SQLite. Failed batches remain dirty.
      const documents = yield* Effect.forEach(
        snapshot.keys(),
        Effect.fnUntraced(function* (file) {
          const document = yield* Effect.gen(function* () {
            const info = yield* fs.stat(file)
            return info.type === "File" ? yield* filesystem.read(file) : undefined
          }).pipe(
            Effect.catchTags({
              PlatformError: (error) => (error.reason._tag === "NotFound" ? Effect.undefined : error)
            })
          )
          return { name: path.basename(file, ".md"), document }
        })
      )
      yield* Effect.gen(function* () {
        const removed: Array<string> = []
        yield* Effect.forEach(
          documents,
          Effect.fnUntraced(function* (entry) {
            const rows = yield* db.select().from(table).where(eq(table.name, entry.name))
            const row = rows[0]
            if (entry.document === undefined) {
              if (row !== undefined) removed.push(entry.name)
            } else if (row === undefined) {
              yield* db.insert(table).values(values(entry.document))
            } else if (!equivalent(fromRow(row), entry.document)) {
              yield* db.update(table).set(values(entry.document)).where(eq(table.name, entry.name))
            }
          }),
          { discard: true }
        )
        yield* Effect.forEach(
          Array.chunksOf(removed, 100),
          (names) => db.delete(table).where(inArray(table.name, names)),
          { discard: true }
        )
      }).pipe(db.$client.withTransaction)
      acknowledge(snapshot)
    }).pipe(Effect.withSpan("TraitStore.reconcile"))
    const ready = Effect.gen(function* () {
      while (true) {
        if (watcherFailure !== undefined) return yield* watcherFailure
        if (indexedRevision !== fullRevision) yield* rebuild
        else if (dirty.size > 0) yield* reconcile
        else return
      }
    })
    const refresh = invalidate.pipe(
      Effect.andThen(ready),
      Effect.uninterruptible,
      serialize,
      Effect.withSpan("TraitStore.refresh")
    )
    const synchronize = ready.pipe(
      serialize,
      Effect.catchCause((cause) => (Cause.hasInterruptsOnly(cause) ? Effect.interrupt : Effect.logWarning(cause)))
    )
    const get = Effect.fn("TraitStore.getIndexed")(function* (name: Trait.TraitName) {
      yield* ready
      const rows = yield* db.select().from(table).where(eq(table.name, name))
      const row = rows[0]
      return row === undefined ? yield* TraitStore.TraitNotFoundError.make({ name }) : fromRow(row)
    })
    const store = TraitStore.TraitStore.of({
      refresh,
      get: flow(get, serialize),
      ls: Effect.gen(function* () {
        yield* ready
        return yield* db
          .select()
          .from(table)
          .orderBy(table.name)
          .pipe(Effect.map(Array.map(fromRow)))
      }).pipe(serialize, Effect.withSpan("TraitStore.lsIndexed")),
      add: Effect.fn("TraitStore.addIndexed")(
        function* (trait) {
          yield* ready
          const existing = yield* db.select({ name: table.name }).from(table).where(eq(table.name, trait.name))
          if (existing.length > 0) return yield* TraitStore.TraitAlreadyExistsError.make({ name: trait.name })
          yield* filesystem.add(trait).pipe(Effect.tapCause(() => invalidate))
          yield* db
            .insert(table)
            .values(values(trait))
            .pipe(Effect.tapCause(() => invalidate))
          return trait
        },
        Effect.uninterruptible,
        serialize
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
        serialize
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
        serialize
      )
    })
    const started = yield* Deferred.make<void>()
    yield* Effect.gen(function* () {
      yield* fs.makeDirectory(traitsDirectory, { recursive: true })
      const pull = yield* Stream.toPull(fs.watch(traitsDirectory))
      yield* Effect.yieldNow
      watcherFailure = undefined
      yield* synchronize
      yield* Deferred.succeed(started, undefined)
      yield* Stream.fromPull(Effect.succeed(pull)).pipe(
        Stream.tap((event) =>
          Effect.sync(() => {
            const file = path.resolve(traitsDirectory, event.path)
            // Missing/ambiguous filenames require a full rescan, not a guessed incremental update.
            if (file === traitsDirectory) fullRevision = ++revision
            else if (path.dirname(file) === traitsDirectory && path.extname(file) === ".md") dirty.set(file, ++revision)
          })
        ),
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
