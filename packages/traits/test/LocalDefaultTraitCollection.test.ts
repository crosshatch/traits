import { NodeServices } from "@effect/platform-node"
import { expect, layer } from "@effect/vitest"
import { Array, Effect, FileSystem, Layer, Order, Path, pipe, Result, String } from "effect"

import * as LocalDefaultTraitCollection from "../local/LocalDefaultTraitCollection.ts"
import { Trait } from "../Trait/Trait.ts"
import { TraitName } from "../Trait/TraitName.ts"
import { DefaultTraitCollection, TraitAlreadyExistsError } from "../TraitCollection/DefaultTraitCollection.ts"
import { TraitNotFoundError } from "../TraitCollection/TraitCollection.ts"
import { localPaths } from "./_localWorkspace.ts"

const first = TraitName.make("first-trait")
const second = TraitName.make("second-trait")

const trait = (name: string, fields: Partial<typeof Trait.Encoded> = {}) =>
  Trait.make({ name, purpose: "Why it matters.", ...fields } as Trait)

/** The workspace's own traits in this traits directory. Each build is its own instance, with its own in-process lock, as each process has. */
const traitsIn = (directory: string) =>
  Layer.fresh(LocalDefaultTraitCollection.layer).pipe(Layer.provide(localPaths(directory)))

/** Runs the effect against the traits directory of a temporary workspace. */
const withTraits = <A, E>(
  effect: (traits: string) => Effect.Effect<A, E, DefaultTraitCollection | FileSystem.FileSystem | Path.Path>
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* fs.makeTempDirectoryScoped()
    const directory = path.join(root, "traits")
    yield* fs.makeDirectory(directory)
    return yield* effect(directory).pipe(Effect.provide(traitsIn(directory)))
  })

layer(NodeServices.layer)((it) => {
  it.effect("keeps each trait as a file directly under traits/, and nothing else there as a trait", () =>
    withTraits(
      Effect.fn(function* (traits) {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const collection = yield* DefaultTraitCollection
        yield* fs.writeFileString(path.join(traits, "config.json"), "{}")
        yield* fs.writeFileString(path.join(traits, "README.md"), "Not a trait.")
        yield* fs.makeDirectory(path.join(traits, "shared"))
        yield* fs.writeFileString(path.join(traits, "shared", "sourced-trait.md"), "---\nname: sourced-trait\n---\n")

        yield* collection.write(trait("first-trait", { subject: "Notes.", body: "An example." }))
        const stored = yield* fs.readFileString(path.join(traits, "first-trait.md"))
        expect(stored).toBe("---\nname: first-trait\nsubject: Notes.\npurpose: Why it matters.\n---\n\nAn example.\n")
        const names = yield* collection.names
        expect(names).toEqual([first])
        const read = yield* collection.get(first)
        expect(read).toEqual(trait("first-trait", { subject: "Notes.", body: "An example." }))
      })
    )
  )

  it.effect("updates a trait under its own name, renames it, and deletes it", () =>
    withTraits(
      Effect.fn(function* (traits) {
        const fs = yield* FileSystem.FileSystem
        const collection = yield* DefaultTraitCollection
        yield* collection.write(trait("first-trait"))
        yield* collection.write(trait("second-trait"))

        const updated = yield* collection.update(first, () => trait("another-name", { assertion: "It holds." }))
        expect(updated).toEqual(trait("first-trait", { assertion: "It holds." }))

        const taken = yield* Effect.flip(collection.rename(first, second))
        expect(taken).toEqual(TraitAlreadyExistsError.make({ traitName: second }))
        const third = TraitName.make("third-trait")
        const renamed = yield* collection.rename(first, third)
        expect(renamed).toEqual(trait("third-trait", { assertion: "It holds." }))
        const afterRename = yield* collection.names
        expect(afterRename).toEqual([second, third])

        yield* collection.delete(second)
        const files = yield* fs.readDirectory(traits)
        expect(files).toEqual(["third-trait.md"])
      })
    )
  )

  it.effect("lets only one of two processes rename a trait to the same new name, and keeps the other's trait", () =>
    withTraits(
      Effect.fn(function* (traits) {
        const fs = yield* FileSystem.FileSystem
        const collection = yield* DefaultTraitCollection
        const other = yield* Effect.service(DefaultTraitCollection).pipe(Effect.provide(traitsIn(traits)))
        expect(other).not.toBe(collection)
        const third = TraitName.make("third-trait")
        yield* collection.write(trait("first-trait", { purpose: "First." }))
        yield* collection.write(trait("second-trait", { purpose: "Second." }))

        const [one, two] = yield* Effect.all(
          [Effect.result(collection.rename(first, third)), Effect.result(other.rename(second, third))],
          { concurrency: "unbounded" }
        )
        const [won, lost] = Result.isSuccess(one) ? [one, two] : [two, one]
        expect(Result.isSuccess(won)).toBe(true)
        expect(lost).toEqual(Result.fail(TraitAlreadyExistsError.make({ traitName: third })))
        const kept = Result.isSuccess(one) ? "second-trait.md" : "first-trait.md"
        const files = yield* fs.readDirectory(traits)
        expect(Array.sort(files, Order.String)).toEqual([kept, "third-trait.md"])
        const renamed = yield* collection.get(third)
        expect(renamed.purpose).toBe(Result.isSuccess(one) ? "First." : "Second.")
      })
    )
  )

  it.effect("fails with the missing name when there is no such trait", () =>
    withTraits(
      Effect.fn(function* () {
        const collection = yield* DefaultTraitCollection
        const errors = yield* Effect.all(
          [
            Effect.flip(collection.get(first)),
            Effect.flip(collection.update(first, (found) => found)),
            Effect.flip(collection.rename(first, second)),
            Effect.flip(collection.delete(first))
          ],
          { concurrency: 1 }
        )
        const missing = TraitNotFoundError.make({ traitName: first })
        expect(errors).toEqual([missing, missing, missing, missing])
      })
    )
  )

  it.effect("reports a file that is not a valid trait, or whose trait has another name", () =>
    withTraits(
      Effect.fn(function* (traits) {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const collection = yield* DefaultTraitCollection
        yield* fs.writeFileString(path.join(traits, "first-trait.md"), "---\nname: first-trait\n---\n")
        yield* fs.writeFileString(path.join(traits, "second-trait.md"), "---\nname: other\npurpose: Why.\n---\n")
        const invalid = yield* Effect.flip(collection.get(first))
        const misnamed = yield* Effect.flip(collection.get(second))
        expect(invalid).toMatchObject({ _tag: "StorageError", reason: { _tag: "Malformed" } })
        expect(misnamed).toMatchObject({ _tag: "StorageError", reason: { _tag: "Malformed" } })
      })
    )
  )

  it.effect.each([
    ["a colon and a hash", "Files: those under src/ # not tests"],
    ["quotes and a leading hyphen", `- "quoted" and 'single'`],
    ["text that reads as another type", "true"],
    ["several paragraphs", "First paragraph.\n\nSecond paragraph,\nacross two lines."],
    ["surrounding spaces", "  padded  "],
    ["a long line", pipe("A sentence that is long enough to be folded. ", String.repeat(6), String.trim)],
    ["a frontmatter delimiter", "Before\n---\nAfter"],
    ["characters outside ASCII", "Naïve café 😀 — ok"]
  ] as const)("reads back exactly what was written for %s", ([, text]) =>
    withTraits(
      Effect.fn(function* () {
        const collection = yield* DefaultTraitCollection
        const written = trait("first-trait", { subject: text, assertion: text, purpose: text, body: String.trim(text) })
        yield* collection.write(written)
        const read = yield* collection.get(first)
        expect(read).toEqual(written)
      })
    )
  )
})
