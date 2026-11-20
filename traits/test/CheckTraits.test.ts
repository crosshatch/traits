import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Array, Effect, FileSystem, Layer, Path, Stream, String } from "effect"
import { Digest } from "effect/crypto"
import { FetchHttpClient } from "effect/http"

import * as CheckReport from "../CheckReport.ts"
import { ProjectPaths } from "../ProjectPaths.ts"
import * as CheckTraits from "../toolkit/CheckTraits.ts"
import * as Trait from "../Trait.ts"
import * as TraitsConfig from "../TraitsConfig.ts"
import { TraitStore } from "../TraitStore.ts"

const effectUrl = new URL("../../node_modules/effect/dist/index.js", import.meta.url).href
const aiUrl = new URL("../../node_modules/effect/dist/ai/index.js", import.meta.url).href

const trait = Trait.Trait.make({
  name: Trait.TraitName.make("flag-everything"),
  subject: "Any source.",
  requirement: "Flag every file.",
  purpose: "Make every checked file appear in the report.",
  applicability: "All files."
})

it.effect(
  "applies built-in and configured excludes to relative and absolute include patterns",
  Effect.fn("test.CheckTraits.excludes")(
    function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* fs
        .makeTempDirectoryScoped({ prefix: "traits-check-excludes-" })
        .pipe(Effect.flatMap(fs.realPath))
      const files = ["kept.ts", "relative/a.ts", "absolute/a.ts", ".git/a.ts", ".worktrees/branch/a.ts"]
      for (const file of files) {
        yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true })
        yield* fs.writeFileString(path.join(root, file), "const value = 1\n")
      }
      yield* fs.writeFileString(
        path.join(root, "traits.ts"),
        String.stripMargin(`
        |import { Effect, Layer, Record } from ${JSON.stringify(effectUrl)};
        |import { DecisionModel } from ${JSON.stringify(aiUrl)};
        |export default {
        |  excludeGitignored: false,
        |  excludes: ["relative/**", ${JSON.stringify(path.join(root, "absolute", "**"))}],
        |  layerDecisionModel: Layer.effect(DecisionModel.DecisionModel, DecisionModel.make({
        |    decide: (options) => Effect.succeed({
        |      answers: Record.map(options.decisions, () => ({
        |        _tag: "Classify", label: "violation",
        |        probabilities: { compliant: 0, violation: 1, "not-applicable": 0, inconclusive: 0 }
        |      })),
        |      usage: { inputTokens: undefined, outputTokens: undefined }
        |    })
        |  })),
        |  layerLanguageModel: Layer.empty
        |};
        `)
      )
      const cwd = process.cwd()
      yield* Effect.acquireRelease(
        Effect.sync(() => process.chdir(root)),
        () => Effect.sync(() => process.chdir(cwd))
      )
      const check = Effect.fnUntraced(
        function* (include: ReadonlyArray<string>) {
          const toolkit = yield* CheckTraits.toolkit
          const stream = yield* toolkit.handle("check_traits", { include })
          const [result] = yield* Stream.runCollect(stream)
          expect(result?.isFailure).toBe(false)
          return Array.map((result!.result as CheckReport.CheckReport).files, (file) => file.path)
        },
        Effect.provide(
          CheckTraits.layer.pipe(
            Layer.provideMerge(TraitsConfig.layer),
            Layer.provideMerge(Layer.succeed(ProjectPaths, { projectRoot: root, traitsDirectory: root })),
            Layer.provideMerge(
              Layer.succeed(TraitStore, { ls: Effect.succeed([trait]) } as unknown as TraitStore["Service"])
            )
          )
        )
      )
      const relative = yield* check(files)
      const absolute = yield* check(Array.map(files, (file) => path.join(root, file)))
      expect(relative).toEqual([path.join(root, "kept.ts")])
      expect(absolute).toEqual([path.join(root, "kept.ts")])
    },
    Effect.provide([NodeServices.layer, Digest.layerWebCrypto, FetchHttpClient.layer])
  )
)
