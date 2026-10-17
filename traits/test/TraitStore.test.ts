import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Effect, FileSystem, Path, Result } from "effect"

import * as Trait from "../Trait.ts"
import * as TraitStore from "../TraitStore.ts"

it.effect(
  "stores complete traits by unique name without overwriting duplicates",
  Effect.fn("test.TraitStore")(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const dir = yield* fs.makeTempDirectoryScoped({ prefix: "traits-names-" })
    const initial = Trait.Trait.make({
      name: Trait.TraitName.make("test-trait"),
      body: "Original",
      when: "testing asynchronous operations.",
      mime: ["text/typescript", "text/tsx"],
      skip: "When a synchronous framework contract must be preserved.",
      priority: 2
    })
    yield* Effect.gen(function* () {
      const store = yield* TraitStore.TraitStore
      const added = yield* store.add(initial)
      expect(added).toEqual(initial)
      const loaded = yield* store.get(initial.name)
      expect(loaded).toEqual(initial)
      const updated = Trait.Trait.make({ ...initial, body: "Replacement", priority: 3 })
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
      const missing = yield* store.get(initial.name).pipe(Effect.result)
      expect(Result.isFailure(missing)).toBe(true)
      if (Result.isFailure(missing))
        expect(missing.failure).toMatchObject({ _tag: "TraitNotFoundError", name: initial.name })
      yield* store.rm([renamed.name])
      const remaining = yield* store.ls
      expect(remaining).toEqual([])
    }).pipe(Effect.provide(TraitStore.layerFileSystem(dir)))
  }, Effect.provide(NodeServices.layer))
)

it.effect(
  "rejects mismatched filenames on reads, updates, removals, and listing",
  Effect.fn("test.TraitStore.nameMismatch")(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const dir = yield* fs.makeTempDirectoryScoped({ prefix: "traits-mismatch-" })
    const actual = Trait.Trait.make({ name: Trait.TraitName.make("actual-name"), body: "Body" })
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
        const result = yield* operation.pipe(Effect.result)
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
    }).pipe(Effect.provide(TraitStore.layerFileSystem(dir)))
  }, Effect.provide(NodeServices.layer))
)
