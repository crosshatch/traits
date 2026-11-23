import { NodeServices } from "@effect/platform-node"
import { expect, layer } from "@effect/vitest"
import { Effect, FileSystem, Layer, Path } from "effect"

import * as LocalTraitSelections from "../local/LocalTraitSelections.ts"
import { TraitName } from "../Trait/TraitName.ts"
import { TraitSourceId } from "../TraitCollection/TraitSourceId.ts"
import * as TraitSelections from "../TraitSelection/TraitSelections.ts"
import { configText, localPaths } from "./_localWorkspace.ts"

const ci = TraitSelections.TraitSelectionId.make("ci")
const docs = TraitSelections.TraitSelectionId.make("docs")
const own = { name: TraitName.make("my-trait") }
const sourced = { source: TraitSourceId.make("effect"), name: TraitName.make("my-trait") }

/** Runs the effect against the selections of a temporary workspace whose traits/config.json has this text, when there is one. */
const withSelections = <A, E>(
  effect: (file: string) => Effect.Effect<A, E, TraitSelections.TraitSelections | FileSystem.FileSystem>,
  text?: string
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = yield* fs.makeTempDirectoryScoped()
    const file = path.join(directory, "config.json")
    if (text !== undefined) {
      yield* fs.writeFileString(file, text)
    }
    return yield* effect(file).pipe(
      Effect.provide(LocalTraitSelections.layer.pipe(Layer.provide(localPaths(directory))))
    )
  })

const declared = configText({
  sources: { effect: { directory: "../effect-traits" } },
  selections: { ci: ["my-trait", "effect/my-trait"], docs: [] }
})

layer(NodeServices.layer)((it) => {
  it.effect("takes the selections declared in the configuration, in the order they are declared", () =>
    withSelections(
      Effect.fn(function* () {
        const selections = yield* TraitSelections.TraitSelections
        const all = yield* selections.ls
        expect(all).toEqual([
          { id: ci, traits: [own, sourced] },
          { id: docs, traits: [] }
        ])
        const one = yield* selections.get(ci)
        expect(one).toEqual({ id: ci, traits: [own, sourced] })
      }),
      declared
    )
  )

  it.effect("has no selections when the configuration declares none", () =>
    withSelections(
      Effect.fn(function* () {
        const selections = yield* TraitSelections.TraitSelections
        const all = yield* selections.ls
        expect(all).toEqual([])
      }),
      configText({})
    )
  )

  it.effect.each(["0.0.1", "99.0.0"])(
    "reads a configuration written for traits %s, whatever version is installed",
    (version) =>
      withSelections(
        Effect.fn(function* () {
          const selections = yield* TraitSelections.TraitSelections
          const all = yield* selections.ls
          expect(all).toEqual([{ id: ci, traits: [own] }])
        }),
        configText({ version, selections: { ci: ["my-trait"] } })
      )
  )

  it.effect("follows an edit to the configuration", () =>
    withSelections(
      Effect.fn(function* (file) {
        const fs = yield* FileSystem.FileSystem
        const selections = yield* TraitSelections.TraitSelections
        yield* fs.writeFileString(file, configText({ selections: { nightly: ["my-trait"] } }))
        const all = yield* selections.ls
        expect(all).toEqual([{ id: TraitSelections.TraitSelectionId.make("nightly"), traits: [own] }])
      }),
      declared
    )
  )

  it.effect.each(["nightly", "constructor"])("fails with the missing ID when no selection is declared as %s", (id) =>
    withSelections(
      Effect.fn(function* () {
        const selections = yield* TraitSelections.TraitSelections
        const missing = TraitSelections.TraitSelectionId.make(id)
        const error = yield* Effect.flip(selections.get(missing))
        expect(error).toEqual(TraitSelections.TraitSelectionNotFoundError.make({ traitSelectionId: missing }))
      }),
      declared
    )
  )

  it.effect.each([
    ["a selection ID that is not kebab-case", { selections: { "Not Kebab": [] } }],
    ["a reference that is not a path to a trait", { selections: { ci: ["a/b/c"] } }],
    ["a reference written as an object", { selections: { ci: [{ name: "my-trait" }] } }],
    ["a selection that is not a list", { selections: { ci: "my-trait" } }],
    ["a reference to a source that is not declared", { selections: { ci: ["effect/my-trait"] } }]
  ] as const)("reports %s as a malformed configuration", ([, fields]) =>
    withSelections(
      Effect.fn(function* (file) {
        const selections = yield* TraitSelections.TraitSelections
        const error = yield* Effect.flip(selections.ls)
        expect(error.reason._tag).toBe("Malformed")
        expect(error.location).toBe(file)
      }),
      configText(fields)
    )
  )

  it.effect("reports a configuration that does not exist as missing", () =>
    withSelections(
      Effect.fn(function* (file) {
        const selections = yield* TraitSelections.TraitSelections
        const error = yield* Effect.flip(selections.ls)
        expect(error).toMatchObject({ _tag: "StorageError", location: file, reason: { _tag: "Missing" } })
      })
    )
  )
})
