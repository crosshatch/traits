import { NodeServices } from "@effect/platform-node"
import { expect, layer } from "@effect/vitest"
import { Effect, FileSystem, Layer, Path, pipe, String } from "effect"
import { Digest } from "effect/crypto"
import type { ChildProcessSpawner } from "effect/process"

import * as LocalTraitCollections from "../local/LocalTraitCollections.ts"
import { TraitName } from "../Trait/TraitName.ts"
import { TraitCollections } from "../TraitCollection/TraitCollections.ts"
import { TraitSourceId } from "../TraitCollection/TraitSourceId.ts"
import { configText, git, localPaths } from "./_localWorkspace.ts"

const shared = TraitSourceId.make("shared")
const first = TraitName.make("first-trait")
const second = TraitName.make("second-trait")

const traitFile = (name: string, purpose = "Why it matters.") => `---\nname: ${name}\npurpose: ${purpose}\n---\n`

/** Runs the effect in a temporary workspace declaring the given sources, with an empty upstream directory of traits beside it. */
const withWorkspace = <A, E>(
  sources: (upstream: string) => unknown,
  effect: (workspace: {
    readonly upstream: string
    readonly traits: string
  }) => Effect.Effect<
    A,
    E,
    TraitCollections | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  >
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* fs.makeTempDirectoryScoped()
    const upstream = path.join(root, "upstream")
    const traits = path.join(root, "workspace", "traits")
    yield* fs.makeDirectory(path.join(upstream, "traits"), { recursive: true })
    yield* fs.makeDirectory(traits, { recursive: true })
    yield* fs.writeFileString(path.join(traits, "config.json"), configText({ sources: sources(upstream) }))
    return yield* effect({ upstream, traits }).pipe(
      Effect.provide(LocalTraitCollections.layer.pipe(Layer.provide(localPaths(traits))))
    )
  })

/** Commits everything in the upstream directory and returns the commit. */
const commit = Effect.fn("commit")(function* (upstream: string) {
  yield* git(upstream, "add", "--all")
  yield* git(upstream, "commit", "--quiet", "--message", "change")
  return yield* git(upstream, "rev-parse", "HEAD")
})

layer(Layer.mergeAll(NodeServices.layer, Digest.layerWebCrypto))((it) => {
  it.effect("keeps a directory source's traits in traits/<id>/, changing them only on update", () =>
    withWorkspace(
      () => ({ shared: { directory: "../upstream/traits" } }),
      Effect.fn(function* ({ traits, upstream }) {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const collections = yield* TraitCollections
        yield* fs.writeFileString(path.join(upstream, "traits", "first-trait.md"), traitFile("first-trait"))
        yield* fs.writeFileString(path.join(upstream, "traits", "README.md"), "Not a trait.")
        const declared = yield* collections.sources
        expect(declared).toEqual({ shared: { directory: "../upstream/traits" } })

        const before = yield* Effect.flip(collections.get(shared))
        expect(before).toMatchObject({ _tag: "StorageError", reason: { _tag: "NotUpdated" } })

        const added = yield* collections.update(shared)
        expect(added).toEqual({ added: [first], changed: [], removed: [] })
        const stored = yield* fs.readFileString(path.join(traits, "shared", "first-trait.md"))
        expect(stored).toBe(traitFile("first-trait"))

        yield* fs.writeFileString(path.join(upstream, "traits", "second-trait.md"), traitFile("second-trait"))
        const fixed = yield* collections.get(shared)
        const unchanged = yield* fixed.names
        expect(unchanged).toEqual([first])
        const missing = yield* Effect.flip(fixed.get(second))
        expect(missing).toMatchObject({ _tag: "TraitNotFoundError", traitName: second })

        yield* collections.update(shared)
        const refreshed = yield* collections.get(shared)
        const trait = yield* refreshed.get(second)
        expect(trait).toEqual({ name: second, purpose: "Why it matters." })
      })
    )
  )

  it.effect("reports what an update added, changed, and removed, leaving other files in the directory alone", () =>
    withWorkspace(
      () => ({ shared: { directory: "../upstream/traits" } }),
      Effect.fn(function* ({ traits, upstream }) {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const collections = yield* TraitCollections
        const third = TraitName.make("third-trait")
        yield* fs.writeFileString(path.join(upstream, "traits", "first-trait.md"), traitFile("first-trait"))
        yield* fs.writeFileString(path.join(upstream, "traits", "second-trait.md"), traitFile("second-trait"))
        yield* collections.update(shared)
        yield* fs.writeFileString(path.join(traits, "shared", "notes.txt"), "Kept.")

        yield* fs.writeFileString(path.join(upstream, "traits", "first-trait.md"), traitFile("first-trait", "New."))
        yield* fs.remove(path.join(upstream, "traits", "second-trait.md"))
        yield* fs.writeFileString(path.join(upstream, "traits", "third-trait.md"), traitFile("third-trait"))
        const changes = yield* collections.updateAll
        expect(changes).toEqual({ shared: { added: [third], changed: [first], removed: [second] } })
        const files = yield* fs.readDirectory(path.join(traits, "shared"))
        expect(new Set(files)).toEqual(new Set(["first-trait.md", "third-trait.md", "notes.txt"]))

        const again = yield* collections.update(shared)
        expect(again).toEqual({ added: [], changed: [], removed: [] })
      })
    )
  )

  it.effect("writes only the files an update adds or changes, leaving the others as they are on disk", () =>
    withWorkspace(
      () => ({ shared: { directory: "../upstream/traits" } }),
      Effect.fn(function* ({ traits, upstream }) {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const collections = yield* TraitCollections
        yield* fs.writeFileString(path.join(upstream, "traits", "first-trait.md"), traitFile("first-trait"))
        yield* fs.writeFileString(path.join(upstream, "traits", "second-trait.md"), traitFile("second-trait"))
        yield* collections.update(shared)
        // As when Git checks a committed file out with CRLF line endings.
        const checkedOut = pipe(traitFile("first-trait"), String.replaceAll("\n", "\r\n"))
        yield* fs.writeFileString(path.join(traits, "shared", "first-trait.md"), checkedOut)

        yield* fs.writeFileString(path.join(upstream, "traits", "second-trait.md"), traitFile("second-trait", "New."))
        const changes = yield* collections.update(shared)
        expect(changes).toEqual({ added: [], changed: [second], removed: [] })
        const untouched = yield* fs.readFileString(path.join(traits, "shared", "first-trait.md"))
        const rewritten = yield* fs.readFileString(path.join(traits, "shared", "second-trait.md"))
        expect(untouched).toBe(checkedOut)
        expect(rewritten).toBe(traitFile("second-trait", "New."))
        const files = yield* fs.readDirectory(path.join(traits, "shared"))
        expect(new Set(files)).toEqual(new Set(["first-trait.md", "second-trait.md"]))
        yield* collections.get(shared)
      })
    )
  )

  it.effect("refuses a collection that was edited by hand or whose declaration changed, until it is updated", () =>
    withWorkspace(
      () => ({ shared: { directory: "../upstream/traits" } }),
      Effect.fn(function* ({ traits, upstream }) {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const collections = yield* TraitCollections
        yield* fs.writeFileString(path.join(upstream, "traits", "first-trait.md"), traitFile("first-trait"))
        yield* collections.update(shared)

        const snapshot = path.join(traits, "shared", "first-trait.md")
        yield* fs.writeFileString(snapshot, traitFile("first-trait", "Edited by hand."))
        const modified = yield* Effect.flip(collections.get(shared))
        expect(modified).toMatchObject({ _tag: "StorageError", reason: { _tag: "Modified" } })
        const restoring = yield* collections.update(shared)
        expect(restoring).toEqual({ added: [], changed: [first], removed: [] })

        yield* fs.writeFileString(snapshot, pipe(traitFile("first-trait"), String.replaceAll("\n", "\r\n")))
        yield* collections.get(shared)

        yield* fs.writeFileString(
          path.join(traits, "config.json"),
          configText({ sources: { shared: { directory: path.join(upstream, "traits") } } })
        )
        const redeclared = yield* Effect.flip(collections.get(shared))
        expect(redeclared).toMatchObject({ _tag: "StorageError", reason: { _tag: "NotUpdated" } })
      })
    )
  )

  it.effect("leaves a collection as it was when its source holds a file that is not a valid trait", () =>
    withWorkspace(
      () => ({ shared: { directory: "../upstream/traits" } }),
      Effect.fn(function* ({ upstream }) {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const collections = yield* TraitCollections
        yield* fs.writeFileString(path.join(upstream, "traits", "first-trait.md"), traitFile("first-trait"))
        yield* collections.update(shared)

        yield* fs.writeFileString(path.join(upstream, "traits", "second-trait.md"), traitFile("another-name"))
        const error = yield* Effect.flip(collections.update(shared))
        expect(error._tag).toBe("TraitCollectionUpdateError")
        expect(error.message).toContain("its name another-name does not match its file name second-trait.md")
        const collection = yield* collections.get(shared)
        const names = yield* collection.names
        expect(names).toEqual([first])
      })
    )
  )

  it.effect("fails for an ID that no source has, and reports a source declared with an ID that is not valid", () =>
    withWorkspace(
      () => ({ "Not Kebab": { directory: "../upstream/traits" } }),
      Effect.fn(function* ({ traits }) {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const collections = yield* TraitCollections
        const invalid = yield* Effect.flip(collections.sources)
        expect(invalid).toMatchObject({ _tag: "StorageError", reason: { _tag: "Malformed" } })

        yield* fs.writeFileString(path.join(traits, "config.json"), configText({}))
        const got = yield* Effect.flip(collections.get(shared))
        const updated = yield* Effect.flip(collections.update(shared))
        expect(got).toMatchObject({ _tag: "TraitCollectionNotFoundError", traitSourceId: shared })
        expect(updated).toMatchObject({ _tag: "TraitCollectionNotFoundError", traitSourceId: shared })
      })
    )
  )

  it.effect("takes a Git source's traits from its branch, recording the commit, and moves on update", () =>
    withWorkspace(
      (upstream) => ({ shared: { git: upstream }, pinned: { git: upstream, ref: "v1", path: "traits" } }),
      Effect.fn(function* ({ traits, upstream }) {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const collections = yield* TraitCollections
        const revision = (id: string) =>
          fs
            .readFileString(path.join(traits, "sources.lock.json"))
            .pipe(Effect.map((text): unknown => JSON.parse(text)[id].revision))

        yield* git(upstream, "init", "--quiet", "--initial-branch", "main")
        yield* fs.writeFileString(path.join(upstream, "traits", "first-trait.md"), traitFile("first-trait"))
        const one = yield* commit(upstream)
        yield* git(upstream, "tag", "v1")
        const declared = yield* collections.sources
        expect(declared[shared]).toEqual({ git: upstream, path: "traits" })

        yield* collections.updateAll
        const sharedAtOne = yield* revision("shared")
        expect(sharedAtOne).toBe(one)

        yield* fs.writeFileString(path.join(upstream, "traits", "second-trait.md"), traitFile("second-trait"))
        const two = yield* commit(upstream)
        const changes = yield* collections.updateAll
        expect(changes).toEqual({
          shared: { added: [second], changed: [], removed: [] },
          pinned: { added: [], changed: [], removed: [] }
        })
        const sharedAtTwo = yield* revision("shared")
        const pinnedAtOne = yield* revision("pinned")
        expect(sharedAtTwo).toBe(two)
        expect(pinnedAtOne).toBe(one)
      })
    )
  )

  it.effect("reports what Git said when a Git source cannot be fetched", () =>
    withWorkspace(
      (upstream) => ({ shared: { git: upstream, ref: "no-such-branch" } }),
      Effect.fn(function* ({ upstream }) {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const collections = yield* TraitCollections
        yield* git(upstream, "init", "--quiet", "--initial-branch", "main")
        yield* fs.writeFileString(path.join(upstream, "traits", "first-trait.md"), traitFile("first-trait"))
        yield* commit(upstream)
        const error = yield* Effect.flip(collections.update(shared))
        expect(error._tag).toBe("TraitCollectionUpdateError")
        expect(error.message).toContain("Git could not fetch the source:")
        expect(error.message).toContain("no-such-branch")
      })
    )
  )
})
