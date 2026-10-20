import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { sql } from "drizzle-orm"
import { Array, Deferred, Effect, Fiber, FileSystem, Layer, Path, Result } from "effect"
import { Reactivity } from "effect/reactivity"

import { ProjectPaths } from "../ProjectPaths.ts"
import { T } from "../tables/index.ts"
import * as Trait from "../Trait.ts"
import * as TraitDatabase from "../TraitDatabase.ts"
import * as TraitDatabaseClient from "../TraitDatabaseClient.ts"
import * as TraitStore from "../TraitStore.ts"

const layerStoreLibsql = (dir: string) =>
  TraitStore.layerLibsql.pipe(
    Layer.provideMerge(TraitDatabase.layer),
    Layer.provide(TraitDatabaseClient.layer),
    Layer.provide(Reactivity.layer),
    Layer.provide(Layer.succeed(ProjectPaths, { projectRoot: dir, traitsDirectory: dir }))
  )

for (const backend of [
  {
    name: "filesystem",
    layer: (dir: string) =>
      TraitStore.layerFileSystem.pipe(
        Layer.provide(Layer.succeed(ProjectPaths, { projectRoot: dir, traitsDirectory: dir }))
      )
  },
  { name: "libsql", layer: layerStoreLibsql }
]) {
  it.effect(
    `${backend.name}: offers consent-based recovery with distinct schema and malformed-document diagnostics without writing`,
    Effect.fn("test.TraitStore.parseError")(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "traits-parse-" })
      const trait = Trait.Trait.make({
        name: Trait.TraitName.make("old-format"),
        subject: "Stored policies.",
        requirement: "Preserve this rule.",
        purpose: "Preserve stored intent."
      })
      const file = path.join(dir, "old-format.md")
      yield* Effect.gen(function* () {
        const store = yield* TraitStore.TraitStore
        for (const fixture of [
          {
            text: "---\nname: old-format\n---\nPreserve this rule.",
            tag: "SchemaError",
            diagnostic: "does not match the installed Trait schema"
          },
          {
            text: "---\nname: [\n---\nPreserve this rule.",
            tag: "InvalidYamlError",
            diagnostic: "do not assume this is a schema migration"
          }
        ]) {
          yield* fs.writeFileString(file, fixture.text)
          for (const operation of [store.ls, store.get(trait.name), store.update(trait), store.rm([trait.name])]) {
            const result = yield* Effect.result<unknown, Effect.Error<typeof operation>, never>(operation)
            expect(Result.isFailure(result)).toBe(true)
            if (Result.isFailure(result)) {
              expect(result.failure).toMatchObject({
                _tag: "TraitParseError",
                path: file,
                cause: { _tag: fixture.tag },
                message: expect.stringContaining(fixture.diagnostic)
              })
              const { message } = result.failure
              for (const instruction of [
                "Ask the developer:",
                "Do not change files before approval",
                "If declined, leave files unchanged",
                "inspect the entire affected trait store",
                "authoritative requirements, applicability, exceptions, examples",
                "ask a focused question",
                "Validate all files",
                "original arguments",
                "A server restart is not necessary",
                "original operation failed"
              ])
                expect(message).toContain(instruction)
            }
          }
          const text = yield* fs.readFileString(file)
          expect(text).toBe(fixture.text)
        }
      }).pipe(Effect.provide(backend.layer(dir)))
    }, Effect.provide(NodeServices.layer))
  )

  it.effect(
    `${backend.name}: stores complete traits by unique name without overwriting duplicates`,
    Effect.fn("test.TraitStore")(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "traits-names-" })
      const initial = Trait.Trait.make({
        name: Trait.TraitName.make("test-trait"),
        subject: "Asynchronous tests.",
        requirement: "Original",
        applicability: "In TypeScript and TSX, except when a synchronous framework contract must be preserved.",
        purpose: "Preserve test lifecycle behavior.",
        context: "Use the Effect-aware test APIs.\n\nSupporting context.\n\n---\nExample.\n"
      })
      yield* Effect.gen(function* () {
        const store = yield* TraitStore.TraitStore
        const added = yield* store.add(initial)
        expect(added).toEqual(initial)
        const loaded = yield* store.get(initial.name)
        expect(loaded).toEqual(initial)
        const updated = Trait.Trait.make({ ...initial, requirement: "Replacement", context: "Updated context.\n" })
        yield* store.update(updated)
        const reloaded = yield* store.get(initial.name)
        expect(reloaded).toEqual(updated)
        const listed = yield* store.ls
        expect(listed).toEqual([updated])
        const file = path.join(dir, `${initial.name}.md`)
        const text = yield* fs.readFileString(file)
        expect(text).toContain(`name: ${initial.name}`)
        expect(text).not.toContain("id:")
        const files = yield* fs.readDirectory(dir)
        expect(files).toEqual([`${initial.name}.md`])
        const collision = yield* store.add(initial).pipe(Effect.result)
        expect(Result.isFailure(collision)).toBe(true)
        if (Result.isFailure(collision)) {
          expect(collision.failure).toBeInstanceOf(TraitStore.TraitAlreadyExistsError)
          expect(collision.failure).toMatchObject({ name: initial.name })
        }
        const afterCollision = yield* store.get(initial.name)
        expect(afterCollision).toEqual(updated)
        const renamed = Trait.Trait.make({ ...updated, name: Trait.TraitName.make("renamed-trait") })
        const missingUpdate = yield* store.update(renamed).pipe(Effect.result)
        expect(Result.isFailure(missingUpdate)).toBe(true)
        if (Result.isFailure(missingUpdate)) expect(missingUpdate.failure).toBeInstanceOf(TraitStore.TraitNotFoundError)
        yield* store.add(renamed)
        yield* store.rm([initial.name])
        const afterRename = yield* store.ls
        expect(afterRename).toEqual([renamed])
        const withoutOptionalFields = Trait.Trait.make({
          name: renamed.name,
          subject: renamed.subject,
          requirement: renamed.requirement,
          purpose: renamed.purpose
        })
        yield* store.update(withoutOptionalFields)
        const cleared = yield* store.get(renamed.name)
        expect(cleared).toEqual(withoutOptionalFields)
        const missing = yield* store.get(initial.name).pipe(Effect.result)
        expect(Result.isFailure(missing)).toBe(true)
        if (Result.isFailure(missing))
          expect(missing.failure).toMatchObject({ _tag: "TraitNotFoundError", name: initial.name })
        yield* store.rm([renamed.name])
        const remaining = yield* store.ls
        expect(remaining).toEqual([])
      }).pipe(Effect.provide(backend.layer(dir)))
    }, Effect.provide(NodeServices.layer))
  )

  it.effect(
    `${backend.name}: rejects mismatched filenames on reads, updates, removals, and listing`,
    Effect.fn("test.TraitStore.nameMismatch")(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "traits-mismatch-" })
      const actual = Trait.Trait.make({
        name: Trait.TraitName.make("actual-name"),
        subject: "An artifact.",
        requirement: "Preserve its identity.",
        purpose: "Avoid identity mismatches."
      })
      const wrongName = Trait.TraitName.make("wrong-name")
      const file = path.join(dir, `${wrongName}.md`)
      yield* fs.writeFileString(file, Trait.serialize(actual))
      yield* Effect.gen(function* () {
        const store = yield* TraitStore.TraitStore
        for (const operation of [
          store.get(wrongName),
          store.update(Trait.Trait.make({ ...actual, name: wrongName })),
          store.rm([wrongName]),
          store.ls
        ]) {
          const result = yield* Effect.result<unknown, Effect.Error<typeof operation>, never>(operation)
          expect(Result.isFailure(result)).toBe(true)
          if (Result.isFailure(result))
            expect(result.failure).toMatchObject({
              _tag: "TraitFilenameMismatchError",
              path: file,
              expectedFilename: `${actual.name}.md`
            })
        }
        const text = yield* fs.readFileString(file)
        expect(text).toBe(Trait.serialize(actual))
        yield* store.add(actual)
        const loaded = yield* store.get(actual.name)
        expect(loaded).toEqual(actual)
      }).pipe(Effect.provide(backend.layer(dir)))
    }, Effect.provide(NodeServices.layer))
  )
}

it.effect(
  "indexes on startup and reconciles timestamp-preserving edits, invalid files, and deletions",
  Effect.fn("test.TraitStore.index")(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const dir = yield* fs.makeTempDirectoryScoped({ prefix: "traits-index-test-" })
    const original = Trait.Trait.make({
      name: Trait.TraitName.make("indexed-trait"),
      subject: "Stored traits.",
      requirement: "Original requirement.",
      purpose: "Keep indexed content current."
    })
    const file = path.join(dir, `${original.name}.md`)
    yield* fs.writeFileString(file, Trait.serialize(original))
    yield* fs.utimes(file, 1000, 1000)
    let reads = 0
    const counted = FileSystem.FileSystem.of({
      ...fs,
      readFileString: (file, encoding) => {
        if (path.dirname(file) === dir) reads++
        return fs.readFileString(file, encoding)
      }
    })
    yield* Effect.gen(function* () {
      const store = yield* TraitStore.TraitStore
      const db = yield* TraitDatabase.TraitDatabase
      const startup = yield* db.select().from(T.traits)
      expect(startup).toMatchObject([{ name: original.name, requirement: original.requirement }])
      const initial = yield* store.ls
      expect(initial).toEqual([original])
      const loaded = yield* store.get(original.name)
      expect(loaded).toEqual(original)
      const unchanged = yield* store.ls
      expect(unchanged).toEqual([original])
      expect(reads).toBe(4)

      const edited = Trait.Trait.make({ ...original, requirement: "Modified requirement." })
      yield* fs.writeFileString(file, Trait.serialize(edited))
      yield* fs.utimes(file, 1000, 1000)
      const refreshed = yield* store.get(original.name)
      expect(refreshed).toEqual(edited)
      expect(reads).toBe(5)

      yield* fs.writeFileString(file, "---\nname: [\n---\n")
      const invalid = yield* store.ls.pipe(Effect.result)
      expect(Result.isFailure(invalid)).toBe(true)
      if (Result.isFailure(invalid)) expect(invalid.failure).toBeInstanceOf(TraitStore.TraitParseError)
      yield* fs.writeFileString(file, Trait.serialize(edited))
      const repaired = yield* store.ls
      expect(repaired).toEqual([edited])

      yield* fs.remove(file)
      const deleted = yield* store.ls
      expect(deleted).toEqual([])
      const missing = yield* store.get(original.name).pipe(Effect.result)
      expect(Result.isFailure(missing)).toBe(true)
      if (Result.isFailure(missing)) expect(missing.failure).toBeInstanceOf(TraitStore.TraitNotFoundError)
    }).pipe(Effect.provide(layerStoreLibsql(dir)), Effect.provideService(FileSystem.FileSystem, counted))
  }, Effect.provide(NodeServices.layer))
)

it.effect(
  "writes through before returning, serializes mutations, and recovers from a failed database write",
  Effect.fn("test.TraitStore.writeThrough")(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const dir = yield* fs.makeTempDirectoryScoped({ prefix: "traits-write-through-" })
    yield* Effect.gen(function* () {
      const store = yield* TraitStore.TraitStore
      const db = yield* TraitDatabase.TraitDatabase
      const original = Trait.Trait.make({
        name: Trait.TraitName.make("write-through"),
        subject: "Stored traits.",
        requirement: "Original requirement.",
        purpose: "Keep both representations synchronized.",
        context: "Original body.\n"
      })
      const additions = yield* Effect.all(
        [store.add(original).pipe(Effect.result), store.add(original).pipe(Effect.result)],
        { concurrency: "unbounded" }
      )
      expect(Array.filter(additions, Result.isSuccess)).toHaveLength(1)
      const inserted = yield* db.select().from(T.traits)
      expect(inserted).toMatchObject([{ name: original.name, context: original.context }])

      const updated = Trait.Trait.make({ ...original, requirement: "Updated requirement.", context: undefined })
      yield* store.update(updated)
      const replaced = yield* db.select().from(T.traits)
      expect(replaced).toMatchObject([{ requirement: updated.requirement, context: null }])

      yield* db.run(
        sql`CREATE TRIGGER reject_trait_insert BEFORE INSERT ON traits BEGIN SELECT RAISE(ABORT, 'injected write failure'); END`
      )
      const failed = yield* store.update(original).pipe(Effect.result)
      expect(Result.isFailure(failed)).toBe(true)
      const afterFailure = yield* db.select().from(T.traits)
      expect(afterFailure).toEqual([])
      const markdown = yield* fs.readFileString(path.join(dir, `${original.name}.md`))
      expect(markdown).toBe(Trait.serialize(original))
      yield* db.run(sql`DROP TRIGGER reject_trait_insert`)
      const recovered = yield* store.get(original.name)
      expect(recovered).toEqual(original)
      yield* store.rm([original.name])
      const removed = yield* db.select().from(T.traits)
      expect(removed).toEqual([])
      const files = yield* fs.readDirectory(dir)
      expect(files).toEqual([])
    }).pipe(Effect.provide(layerStoreLibsql(dir)))
  }, Effect.provide(NodeServices.layer))
)

it.effect(
  "finishes database synchronization when interrupted after publishing a file",
  Effect.fn("test.TraitStore.interruption")(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const dir = yield* fs.makeTempDirectoryScoped({ prefix: "traits-interrupt-" })
    const published = yield* Deferred.make<void>()
    const resume = yield* Deferred.make<void>()
    const original = Trait.Trait.make({
      name: Trait.TraitName.make("interrupted-write"),
      subject: "Trait mutations.",
      requirement: "Original.",
      purpose: "Finish write-through before cancellation."
    })
    yield* fs.writeFileString(path.join(dir, `${original.name}.md`), Trait.serialize(original))
    const controlled = FileSystem.FileSystem.of({
      ...fs,
      rename: Effect.fn("test.publish")(function* (from, to) {
        yield* fs.rename(from, to)
        yield* Deferred.succeed(published, undefined)
        yield* Deferred.await(resume)
      })
    })
    yield* Effect.gen(function* () {
      const store = yield* TraitStore.TraitStore
      const db = yield* TraitDatabase.TraitDatabase
      const updated = Trait.Trait.make({ ...original, requirement: "Replacement." })
      const writer = yield* store.update(updated).pipe(Effect.forkScoped)
      yield* Deferred.await(published)
      const interruption = yield* Fiber.interrupt(writer).pipe(Effect.forkScoped)
      yield* Deferred.succeed(resume, undefined)
      yield* Fiber.join(interruption)
      const rows = yield* db.select().from(T.traits)
      expect(rows).toMatchObject([{ name: original.name, requirement: updated.requirement }])
      const content = yield* fs.readFileString(path.join(dir, `${original.name}.md`))
      expect(content).toBe(Trait.serialize(updated))
      const files = yield* fs.readDirectory(dir)
      expect(files).toEqual([`${original.name}.md`])
    }).pipe(Effect.provide(layerStoreLibsql(dir)), Effect.provideService(FileSystem.FileSystem, controlled))
  }, Effect.provide(NodeServices.layer))
)

it.effect(
  "preserves the previous Markdown and removes temporary files when staging a write fails",
  Effect.fn("test.TraitStore.atomicFailure")(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const dir = yield* fs.makeTempDirectoryScoped({ prefix: "traits-atomic-" })
    const original = Trait.Trait.make({
      name: Trait.TraitName.make("atomic-write"),
      subject: "Trait files.",
      requirement: "Preserve complete content.",
      purpose: "Avoid damaging the previous file on write failure."
    })
    const file = path.join(dir, `${original.name}.md`)
    yield* fs.writeFileString(file, Trait.serialize(original))
    const failing = FileSystem.FileSystem.of({
      ...fs,
      writeFileString: Effect.fn("test.failStaging")(function* (target) {
        yield* fs.writeFileString(target, "partial staging content")
        yield* fs.readFileString(path.join(dir, "missing-file"))
      })
    })
    yield* Effect.gen(function* () {
      const store = yield* TraitStore.TraitStore
      const result = yield* store
        .update(Trait.Trait.make({ ...original, requirement: "Replacement." }))
        .pipe(Effect.result)
      expect(Result.isFailure(result)).toBe(true)
      const content = yield* fs.readFileString(file)
      expect(content).toBe(Trait.serialize(original))
      const recovered = yield* store.get(original.name)
      expect(recovered).toEqual(original)
      const files = yield* fs.readDirectory(dir)
      expect(files).toEqual([`${original.name}.md`])
    }).pipe(Effect.provide(layerStoreLibsql(dir)), Effect.provideService(FileSystem.FileSystem, failing))
  }, Effect.provide(NodeServices.layer))
)
