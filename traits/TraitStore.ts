import { eq, inArray } from "drizzle-orm"
import {
  Array,
  Cause,
  Context,
  Deferred,
  Effect,
  Fiber,
  FileSystem,
  flow,
  Layer,
  Option,
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
import { Digest } from "effect/crypto"
import { dual } from "effect/Function"

import * as AtomicFile from "./_util/AtomicFile.ts"
import { ProjectPaths } from "./ProjectPaths.ts"
import { T } from "./tables/traitIndex/index.ts"
import * as Trait from "./Trait.ts"
import { TraitIndex } from "./TraitIndex.ts"
import { TraitsContext } from "./TraitsContext.ts"
import { TraitWriteLock } from "./TraitWriteLock.ts"

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
  traitName: Trait.TraitName
}) {
  override get message() {
    return `Trait ${this.traitName} was not found`
  }
}

export class TraitAlreadyExistsError extends S.TaggedError<TraitAlreadyExistsError>()("TraitAlreadyExistsError", {
  traitName: Trait.TraitName
}) {
  override get message() {
    return `Trait ${this.traitName} already exists`
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

/** SHA-256 of a trait file's exact Markdown text; identifies the version a change was based on. */
export type ContentHash = typeof ContentHash.Type
export const ContentHash = S.String.pipe(S.brand("traits/ContentHash"))

export interface StoredTrait {
  readonly trait: Trait.Trait
  readonly version: ContentHash
}

/** Every stored trait, plus a version that changes whenever any trait file does. */
export interface TraitSnapshot {
  readonly traits: ReadonlyArray<StoredTrait>
  readonly version: ContentHash
}

/** The on-disk state a trait file must still have for a change to apply. */
export type TraitExpectation = typeof TraitExpectation.Type
export const TraitExpectation = S.Union([
  S.TaggedStruct("Absent", {}),
  S.TaggedStruct("Present", { version: ContentHash })
]).pipe(S.toTaggedUnion("_tag"))

/** The state `name` had in `snapshot`, for changes based on that snapshot. */
export const expectation: {
  (name: Trait.TraitName): (snapshot: TraitSnapshot) => TraitExpectation
  (snapshot: TraitSnapshot, name: Trait.TraitName): TraitExpectation
} = dual(2, (snapshot: TraitSnapshot, name: Trait.TraitName): TraitExpectation =>
  pipe(
    snapshot.traits,
    Array.findFirst((stored) => stored.trait.name === name),
    Option.match({
      onNone: () => TraitExpectation.cases.Absent.make({}),
      onSome: ({ version }) => TraitExpectation.cases.Present.make({ version })
    })
  )
)

export type TraitChange = typeof TraitChange.Type
export const TraitChange = S.Union([
  S.TaggedStruct("Put", { trait: Trait.Trait, expected: TraitExpectation }),
  S.TaggedStruct("Remove", { traitName: Trait.TraitName, version: ContentHash })
]).pipe(S.toTaggedUnion("_tag"))

export class TraitChangedError extends S.TaggedError<TraitChangedError>()("TraitChangedError", {
  traitNames: S.Array(Trait.TraitName)
}) {
  override get message() {
    return `Traits changed after they were read: ${Array.join(this.traitNames, ", ")}`
  }
}

const watchProbePrefix = ".traits-watch-"

/** Markdown is authoritative; watch notifications reconcile only affected files. */
const make = Effect.gen(function* () {
  const db = yield* TraitIndex
  const lock = yield* TraitWriteLock
  const digest = yield* Digest.Digest
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { traitsDirectory } = yield* ProjectPaths
  const { asFileRead } = yield* TraitsContext
  yield* fs.makeDirectory(traitsDirectory, { recursive: true })
  const traitPath = (name: Trait.TraitName) => path.join(traitsDirectory, `${name}.md`)
  const hash = (text: string) =>
    digest.digestHex(Digest.sha256, new TextEncoder().encode(text)).pipe(Effect.map((hex) => ContentHash.make(hex)))
  const readFile = Effect.fn("TraitStore.readFile")(function* (file: string) {
    const text = yield* fs.readFileString(file)
    const trait = yield* Trait.parse(text, file).pipe(
      Effect.mapError((cause) => TraitParseError.make({ path: file, cause })),
      Effect.filterOrFail(
        (trait) => `${trait.name}.md` === path.basename(file),
        (trait) => TraitFilenameMismatchError.make({ path: file, expectedFilename: `${trait.name}.md` })
      )
    )
    const version = yield* hash(text)
    return { trait, version } satisfies StoredTrait
  })
  const absent = TraitExpectation.cases.Absent.make({})
  // The current on-disk state, read under the write lock for compare-and-swap checks.
  const readExpectation = (name: Trait.TraitName) =>
    fs.readFileString(traitPath(name)).pipe(
      Effect.flatMap((text) =>
        Effect.map(hash(text), (version): TraitExpectation => TraitExpectation.cases.Present.make({ version }))
      ),
      Effect.catchTags({
        PlatformError: (error) => (error.reason._tag === "NotFound" ? Effect.succeed(absent) : error)
      })
    )
  const sameExpectation = S.toEquivalence(TraitExpectation)
  const semaphore = yield* Semaphore.make(1)
  const serialize = semaphore.withPermits(1)
  const table = T.traits
  // Generations ensure events arriving during a scan or SQL transaction are not acknowledged early.
  let revision = 0
  let fullRevision = 0
  let indexedRevision = -1
  const dirty = new Map<string, number>()
  let watcherFailure: PlatformError.PlatformError | undefined
  const invalidate = Effect.sync(() => {
    fullRevision = ++revision
  })
  const values = ({ trait, version }: StoredTrait) => ({
    ...trait,
    applicability: trait.applicability ?? null,
    context: trait.context ?? null,
    version
  })
  const fromRow = (row: T.traits["$inferSelect"]): StoredTrait => ({
    trait: Trait.Trait.make({
      name: Trait.TraitName.make(row.name),
      subject: row.subject,
      requirement: row.requirement,
      ...(row.applicability === null ? {} : { applicability: row.applicability }),
      purpose: row.purpose,
      ...(row.context === null ? {} : { context: row.context })
    }),
    version: ContentHash.make(row.version)
  })
  const acknowledge = (snapshot: ReadonlyMap<string, number>) => {
    for (const [file, generation] of snapshot) if (dirty.get(file) === generation) dirty.delete(file)
  }
  const rebuild = Effect.gen(function* () {
    const currentRevision = fullRevision
    const snapshot = new Map(dirty)
    const documents = yield* fs.readDirectory(traitsDirectory).pipe(
      Effect.flatMap(
        flow(
          Array.sort(String.Order),
          Array.filter(String.endsWith(".md")),
          Effect.forEach(
            Effect.fn("TraitStore.readEntry")(function* (name) {
              const file = path.join(traitsDirectory, name)
              const info = yield* fs.stat(file)
              if (info.type !== "File") return undefined
              return yield* readFile(file)
            }, asFileRead),
            { concurrency: "unbounded" }
          )
        )
      ),
      Effect.map(Array.filter(Predicate.isNotUndefined)),
      Effect.withSpan("TraitStore.scanMarkdown")
    )
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
          return info.type === "File" ? yield* readFile(file) : undefined
        }).pipe(
          Effect.catchTags({
            PlatformError: (error) => (error.reason._tag === "NotFound" ? Effect.undefined : error)
          })
        )
        return { name: path.basename(file, ".md"), document }
      }, asFileRead),
      { concurrency: "unbounded" }
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
          } else if (row.version !== entry.document.version) {
            // Unchanged content, including this process's own write-through, needs no SQL.
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
      if (indexedRevision !== fullRevision) yield* rebuild
      else if (dirty.size > 0) yield* reconcile
      else return
    }
  })
  const refresh = invalidate.pipe(
    Effect.andThen(ready),
    Effect.asVoid,
    Effect.uninterruptible,
    serialize,
    Effect.withSpan("TraitStore.refresh")
  )
  const synchronize = ready.pipe(
    serialize,
    Effect.catchCause((cause) => (Cause.hasInterruptsOnly(cause) ? Effect.interrupt : Effect.logWarning(cause)))
  )
  const readIndexed = ready.pipe(
    Effect.andThen(db.select().from(table).orderBy(table.name)),
    Effect.map(Array.map(fromRow))
  )
  const store = {
    refresh,
    get: Effect.fn("TraitStore.getIndexed")(function* (name: Trait.TraitName) {
      yield* ready
      const rows = yield* db.select().from(table).where(eq(table.name, name))
      const row = rows[0]
      return row === undefined ? yield* TraitNotFoundError.make({ traitName: name }) : fromRow(row).trait
    }, serialize),
    ls: readIndexed.pipe(
      Effect.map(Array.map((stored) => stored.trait)),
      serialize,
      Effect.withSpan("TraitStore.lsIndexed")
    ),
    snapshot: Effect.gen(function* () {
      const traits = yield* readIndexed
      const version = yield* hash(JSON.stringify(Array.map(traits, (stored) => [stored.trait.name, stored.version])))
      return { traits, version } satisfies TraitSnapshot
    }).pipe(serialize, Effect.withSpan("TraitStore.snapshot")),
    /**
     * Applies every change only if each target file is still in its expected state. Files are
     * staged before taking the worktree write lock, so the lock covers only the checks and the
     * atomic installs; any mismatch fails with TraitChangedError before anything is written.
     */
    commit: Effect.fn("TraitStore.commit")(
      function* (changes: ReadonlyArray<TraitChange>) {
        yield* ready
        const puts = Array.filter(changes, TraitChange.guards.Put)
        const removes = Array.filter(changes, TraitChange.guards.Remove)
        yield* Effect.gen(function* () {
          const staged = yield* Effect.forEach(
            puts,
            Effect.fnUntraced(function* ({ trait, expected }) {
              const destination = traitPath(trait.name)
              const mode = yield* fs.stat(destination).pipe(
                Effect.map((info) => info.mode),
                Effect.catchTags({
                  PlatformError: (error) => (error.reason._tag === "NotFound" ? Effect.undefined : error)
                })
              )
              const contents = Trait.serialize(trait)
              const temporary = yield* AtomicFile.stage({
                directory: traitsDirectory,
                filename: `${trait.name}.md`,
                contents,
                mode
              })
              const version = yield* hash(contents)
              return { stored: { trait, version }, expected, destination, temporary }
            })
          )
          yield* lock.withLock(
            Effect.gen(function* () {
              const targets = Array.map(
                changes,
                TraitChange.match({
                  Put: ({ trait, expected }) => ({ traitName: trait.name, expected }),
                  Remove: ({ traitName, version }) => ({
                    traitName,
                    expected: TraitExpectation.cases.Present.make({ version })
                  })
                })
              )
              const conflicts = yield* Effect.forEach(
                targets,
                Effect.fnUntraced(function* ({ traitName, expected }) {
                  const actual = yield* readExpectation(traitName)
                  return sameExpectation(expected, actual) ? undefined : traitName
                })
              ).pipe(Effect.map(Array.filter(Predicate.isNotUndefined)))
              if (conflicts.length > 0) return yield* TraitChangedError.make({ traitNames: conflicts })
              yield* Effect.forEach(
                staged,
                ({ stored, expected, destination, temporary }) =>
                  AtomicFile.install(
                    temporary,
                    destination,
                    TraitExpectation.guards.Absent(expected) ? "create" : "replace"
                  ).pipe(
                    Effect.catchTags({
                      PlatformError: (error) =>
                        error.reason._tag === "AlreadyExists"
                          ? TraitChangedError.make({ traitNames: [stored.trait.name] })
                          : error
                    })
                  ),
                { discard: true }
              )
              yield* Effect.forEach(removes, ({ traitName }) => fs.remove(traitPath(traitName)), { discard: true })
            })
          )
          yield* Effect.gen(function* () {
            yield* Effect.forEach(
              staged,
              ({ stored }) =>
                db
                  .insert(table)
                  .values(values(stored))
                  .onConflictDoUpdate({ target: table.name, set: values(stored) }),
              { discard: true }
            )
            yield* Effect.forEach(
              Array.chunksOf(
                Array.map(removes, (change) => change.traitName),
                100
              ),
              (names) => db.delete(table).where(inArray(table.name, names)),
              { discard: true }
            )
          }).pipe(db.$client.withTransaction)
        }).pipe(
          Effect.scoped,
          Effect.provideService(FileSystem.FileSystem, fs),
          Effect.provideService(Path.Path, path),
          Effect.tapCause(() => invalidate)
        )
      },
      Effect.uninterruptible,
      serialize
    )
  }
  const started = yield* Deferred.make<void>()
  yield* Effect.gen(function* () {
    yield* fs.makeDirectory(traitsDirectory, { recursive: true })
    let live = false
    const watcher = yield* fs.watch(traitsDirectory).pipe(
      Stream.tap((event) =>
        Effect.sync(() => {
          watcherFailure = undefined
          const file = path.resolve(traitsDirectory, event.path)
          // Any notification proves the watcher is live. Rescan changes made while it was offline.
          if (!live) {
            fullRevision = ++revision
            live = true
          }
          // Missing/ambiguous filenames require a full rescan, not a guessed incremental update.
          if (pipe(path.basename(file), String.startsWith(watchProbePrefix))) return
          if (file === traitsDirectory) fullRevision = ++revision
          else if (path.dirname(file) === traitsDirectory && path.extname(file) === ".md") dirty.set(file, ++revision)
        })
      ),
      Stream.debounce("50 millis"),
      Stream.runForEach(() => synchronize),
      Effect.forkScoped
    )
    const watchEnded = Fiber.join(watcher).pipe(
      Effect.andThen(
        PlatformError.systemError({
          _tag: "Unknown",
          module: "FileSystem",
          method: "watch",
          pathOrDescriptor: traitsDirectory,
          cause: "The trait directory watch ended unexpectedly."
        })
      )
    )
    // Establish watch readiness before hydrating, so the probe cannot trigger a second full scan.
    yield* fs.makeTempDirectoryScoped({ directory: traitsDirectory, prefix: watchProbePrefix }).pipe(
      Effect.asVoid,
      Effect.scoped,
      Effect.ignore,
      Effect.repeat({ schedule: Schedule.spaced("25 millis"), times: 80, until: () => live }),
      Effect.filterOrFail(
        () => live,
        () =>
          PlatformError.systemError({
            _tag: "TimedOut",
            module: "FileSystem",
            method: "watch",
            pathOrDescriptor: traitsDirectory,
            description: "Directory watcher did not become ready"
          })
      ),
      Effect.raceFirst(watchEnded)
    )
    yield* synchronize.pipe(Effect.raceFirst(watchEnded))
    yield* Deferred.succeed(started, undefined)
    return yield* watchEnded
  }).pipe(
    Effect.scoped,
    // Backend registration may throw or die instead of returning a tagged platform error.
    // Recover here so unsupported watch implementations can still use the polling path.
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
        const firstFailure = watcherFailure === undefined
        watcherFailure = error
        yield* invalidate
        if (firstFailure)
          yield* Effect.logWarning("Trait watch unavailable; polling Markdown while retrying the watcher.", error)
        yield* synchronize
        yield* Deferred.succeed(started, undefined)
      })
    ),
    Effect.retry(Schedule.spaced("1 second")),
    Effect.forkScoped
  )
  yield* Deferred.await(started)
  return store
}).pipe(Effect.withSpan("TraitStore.open"))

export class TraitStore extends Context.Service<TraitStore, Effect.Success<typeof make>>()("traits/TraitStore") {}

export const layer = make.pipe(Layer.effect(TraitStore))
