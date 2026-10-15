import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Effect, FileSystem, Path, Result } from "effect"

import * as Trait from "../Trait.ts"
import { layerFileSystem, TraitStore } from "../TraitStore.ts"

it.effect(
  "loads, lists, adds, and updates traits while preserving frontmatter",
  Effect.fn("test.TraitStore")(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const dir = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "traits-frontmatter-" })
    const name = Trait.TraitName.make("test_trait")
    const initial = yield* Trait.make({
      name,
      body: "Original",
      activation: "When testing.",
      mime: "text/typescript"
    })
    const id = initial.id
    const originalFile = path.join(dir, `${name}-${id}.md`)
    yield* fs.writeFileString(originalFile, Trait.serialize(initial))
    yield* Effect.gen(function* () {
      const store = yield* TraitStore
      const trait = yield* store.get(id)
      expect(trait.body).toBe("Original")
      expect(trait.name).toBe(name)
      expect(trait.activation).toBe("When testing.")
      expect(trait.mime).toBe("text/typescript")
      const listed = yield* store.ls
      expect(listed).toContainEqual(trait)
      const updated = Trait.Trait.make({ ...trait, body: "Replacement" })
      yield* store.update(updated)
      const reloaded = yield* store.get(id)
      expect(reloaded).toEqual(updated)
      const text = yield* fs.readFileString(originalFile)
      expect(text).toContain(`name: ${name}`)
      const renamedName = Trait.TraitName.make("renamed_trait")
      yield* store.update(Trait.Trait.make({ ...updated, name: renamedName }))
      const renamed = yield* store.get(id)
      expect(renamed).toEqual({ ...updated, name: renamedName })
      const originalExists = yield* fs.exists(originalFile)
      expect(originalExists).toBe(false)
      const renamedExists = yield* fs.exists(path.join(dir, `${renamedName}-${id}.md`))
      expect(renamedExists).toBe(true)
      expect(renamed.id).toBe(id)
      yield* store.update(Trait.Trait.make({ ...renamed, body: "Updated after rename" }))
      const completeTrait = yield* Trait.make({
        name: Trait.TraitName.make("new_trait"),
        body: "New body",
        activation: "When testing asynchronous operations.",
        mime: ["text/typescript", "text/tsx"],
        skip: "When a synchronous framework contract must be preserved.",
        priority: 2
      })
      const added = yield* store.add(completeTrait)
      expect(added.body).toBe("New body")
      const saved = yield* store.get(added.id)
      expect(saved).toEqual(completeTrait)
      const replacement = Trait.Trait.make({ ...completeTrait, body: "Updated body", priority: 3 })
      yield* store.update(replacement)
      const updatedComplete = yield* store.get(added.id)
      expect(updatedComplete).toEqual(replacement)
      const files = yield* fs.readDirectory(dir)
      expect(files).toContain(`${added.name}-${added.id}.md`)
      const savedText = yield* fs.readFileString(path.join(dir, `${added.name}-${added.id}.md`))
      expect(savedText).toContain(`name: ${added.name}`)
      expect(savedText).toContain(`id: ${added.id}`)
      const collision = yield* store
        .add(Trait.Trait.make({ ...completeTrait, body: "Must not overwrite" }))
        .pipe(Effect.result)
      expect(Result.isFailure(collision)).toBe(true)
      const afterCollision = yield* store.get(added.id)
      expect(afterCollision).toEqual(replacement)
      const duplicateId = yield* store
        .add(Trait.Trait.make({ ...completeTrait, name: Trait.TraitName.make("different_name") }))
        .pipe(Effect.result)
      expect(Result.isFailure(duplicateId)).toBe(true)
      const stillRenamed = yield* store.get(id)
      expect(stillRenamed.name).toBe(renamedName)
      const sameName = yield* Trait.make({ name: completeTrait.name, body: "Another trait" })
      yield* store.add(sameName)
      const independentlyLoaded = yield* store.get(sameName.id)
      expect(independentlyLoaded).toEqual(sameName)
      expect(sameName.id).not.toBe(completeTrait.id)
      yield* store.update(Trait.Trait.make({ ...stillRenamed, name: sameName.name }))
      const nameChanged = yield* store.get(id)
      expect(nameChanged.name).toBe(sameName.name)
      yield* store.rm([id, added.id])
      const remaining = yield* store.ls
      expect(remaining).not.toContainEqual(replacement)
      const missing = yield* store.get(id).pipe(Effect.result)
      expect(Result.isFailure(missing)).toBe(true)
    }).pipe(Effect.provide(layerFileSystem(dir)))
  }, Effect.provide(NodeServices.layer))
)

it.effect(
  "rejects mismatched filename identity without blocking other lookups",
  Effect.fn("test.TraitStore.nameMismatch")(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const dir = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "traits-names-" })
    const actual = yield* Trait.make({ name: Trait.TraitName.make("actual_name"), body: "Body" })
    yield* fs.writeFileString(path.join(dir, `wrong_name-${actual.id}.md`), Trait.serialize(actual))
    yield* Effect.gen(function* () {
      const store = yield* TraitStore
      const result = yield* store.get(actual.id).pipe(Effect.result)
      expect(Result.isFailure(result)).toBe(true)
      if (Result.isFailure(result)) expect(result.failure).toMatchObject({ reason: "FilenameMismatch" })
      const valid = yield* Trait.make({ name: Trait.TraitName.make("valid_trait"), body: "Body" })
      yield* store.add(valid)
      const loaded = yield* store.get(valid.id)
      expect(loaded).toEqual(valid)
    }).pipe(Effect.provide(layerFileSystem(dir)))
  }, Effect.provide(NodeServices.layer))
)

it.effect(
  "rejects ambiguous UUIDs instead of selecting a filename",
  Effect.fn("test.TraitStore.duplicateIds")(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const dir = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "traits-duplicates-" })
    const first = yield* Trait.make({ name: Trait.TraitName.make("first_trait"), body: "Body" })
    const second = Trait.Trait.make({ ...first, name: Trait.TraitName.make("second_trait") })
    yield* fs.writeFileString(path.join(dir, `${first.name}-${first.id}.md`), Trait.serialize(first))
    yield* fs.writeFileString(path.join(dir, `${second.name}-${second.id}.md`), Trait.serialize(second))
    yield* Effect.gen(function* () {
      const store = yield* TraitStore
      const get = yield* store.get(first.id).pipe(Effect.result)
      const list = yield* store.ls.pipe(Effect.result)
      const remove = yield* store.rm([first.id]).pipe(Effect.result)
      expect(Result.isFailure(get)).toBe(true)
      expect(Result.isFailure(list)).toBe(true)
      expect(Result.isFailure(remove)).toBe(true)
    }).pipe(Effect.provide(layerFileSystem(dir)))
  }, Effect.provide(NodeServices.layer))
)
