import { NodeServices } from "@effect/platform-node"
import { expect, layer } from "@effect/vitest"
import { Array, Effect, FileSystem, Layer, Order, Path, Predicate, Record, Ref } from "effect"
import { DecisionModel } from "effect/ai"
import { Digest } from "effect/crypto"
import { KeyValueStore, UserDirectories } from "effect/persistence"

import * as LocalDefaultTraitCollection from "../local/LocalDefaultTraitCollection.ts"
import * as LocalProjectFiles from "../local/LocalProjectFiles.ts"
import * as LocalTraitCollections from "../local/LocalTraitCollections.ts"
import * as LocalTraitSelections from "../local/LocalTraitSelections.ts"
import * as Segmentation from "../local/Segmentation/Segmentation.ts"
import * as TraitsConfig from "../local/TraitsConfig/TraitsConfig.ts"
import * as DecisionCache from "../TraitRun/DecisionCache.ts"
import * as TraitRun from "../TraitRun/TraitRun.ts"
import { configText, git, localPaths } from "./_localWorkspace.ts"

const traitText = (name: string, subject: string) =>
  `---\nname: ${name}\nsubject: ${subject}\nassertion: It holds.\npurpose: Why.\n---\n`

layer(
  Layer.mergeAll(
    NodeServices.layer,
    Digest.layerWebCrypto,
    UserDirectories.layer,
    DecisionCache.layerKeyValueStore.pipe(Layer.provide(KeyValueStore.layerMemory))
  )
)((it) => {
  it.effect("a second run through the same layers sees the files, configuration, and traits as they are by then", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* Effect.flatMap(fs.makeTempDirectoryScoped(), fs.realPath)
      const traits = path.join(root, "traits")
      const write = (file: string, text: string) => fs.writeFileString(path.join(root, file), text)
      yield* fs.makeDirectory(traits)
      yield* write(
        "traits/config.json",
        configText({ selections: { default: ["first-trait"] }, exclude: ["traits/**"] })
      )
      yield* write("traits/first-trait.md", traitText("first-trait", "First things."))
      yield* write("traits/second-trait.md", traitText("second-trait", "Second things."))
      yield* write("keep.txt", "one")
      yield* write("drop.txt", "gone soon")
      yield* git(root, "init", "--quiet", "--initial-branch", "main")

      // Every subject the model is asked about, with the text it is asked about.
      const asked = yield* Ref.make<ReadonlyArray<string>>([])
      const model = yield* DecisionModel.make({
        decide: Effect.fnUntraced(function* (request) {
          const state = Predicate.isObject(request.state) ? request.state : {}
          const evidence = Predicate.isObject(state["evidence"]) ? state["evidence"] : {}
          const subjects = Array.flatMap(Record.values(request.decisions), ({ instructions }) =>
            Predicate.isObject(instructions) && Predicate.isString(instructions["subject"])
              ? [`${instructions["subject"]} ${globalThis.String(evidence["target"])}`]
              : []
          )
          yield* Ref.update(asked, Array.appendAll(subjects))
          return {
            answers: Record.map(request.decisions, () => ({ _tag: "Probability" as const, probability: 0.9 })),
            usage: { inputTokens: 1, outputTokens: 0 }
          }
        })
      })
      const workspace = Layer.mergeAll(
        LocalDefaultTraitCollection.layer,
        LocalTraitCollections.layer,
        LocalTraitSelections.layer
      ).pipe(Layer.provideMerge(localPaths(traits)))

      yield* Effect.gen(function* () {
        // The layers are built once here, as a host that stays up between runs would have them, and each run is handed what the configuration says by then.
        const run = Effect.gen(function* () {
          const config = yield* TraitsConfig.load
          const files = yield* LocalProjectFiles.make(config.exclude)
          return yield* TraitRun.run({
            files,
            segmentation: Segmentation.prepare(config.segmentation),
            selections: [],
            threshold: 0.5
          })
        })

        const first = yield* run
        expect(Array.map(first.traits, ({ name }) => name)).toEqual(["first-trait"])
        expect(Array.map(first.files, ({ file }) => file)).toEqual(["drop.txt", "keep.txt"])
        const before = yield* Ref.getAndSet(asked, [])
        expect(Array.sort(before, Order.String)).toEqual(["First things. gone soon", "First things. one"])

        yield* write("keep.txt", "two")
        yield* write("new.txt", "new")
        yield* write("traits/second-trait.md", traitText("second-trait", "Later things."))
        yield* write(
          "traits/config.json",
          configText({ selections: { default: ["second-trait"] }, exclude: ["traits/**", "drop.txt"] })
        )

        const second = yield* run
        expect(Array.map(second.traits, ({ name }) => name)).toEqual(["second-trait"])
        expect(Array.map(second.files, ({ file }) => file)).toEqual(["keep.txt", "new.txt"])
        const after = yield* Ref.get(asked)
        expect(Array.sort(after, Order.String)).toEqual(["Later things. new", "Later things. two"])
      }).pipe(Effect.provideService(DecisionModel.DecisionModel, model), Effect.provide(workspace))
    })
  )
})
