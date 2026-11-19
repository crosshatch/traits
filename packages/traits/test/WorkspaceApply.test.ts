import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Array, Effect, FileSystem, Layer, Runtime } from "effect"
import { DecisionModel } from "effect/ai"
import { Digest, SecureRandom } from "effect/crypto"
import { HttpClient } from "effect/http"
import { vi } from "vite-plus/test"

import * as AgentResult from "../Cli/AgentResult.ts"
import * as CodingAgent from "../local/CodingAgent.ts"
import * as WorkspaceApply from "../local/WorkspaceApply.ts"
import { WorkspaceCheck } from "../local/WorkspaceCheck.ts"
import { WorkspaceRoot } from "../local/WorkspaceRoot.ts"
import * as WritableTraitStore from "../local/WritableTraitStore.ts"
import PackageJson from "../package.json" with { type: "json" }
import { Report } from "../Report/Report.ts"
import { Trait } from "../Trait.ts"
import * as TraitFile from "../TraitFile.ts"
import { TraitName } from "../TraitName.ts"
import { TraitOrigin } from "../TraitOrigin.ts"
import { TraitPurpose } from "../TraitPurpose.ts"

vi.mock("../local/WorkspaceModels.ts", () => ({ layerLanguage: () => Layer.empty, layerDecision: () => Layer.empty }))
const platform = Layer.mergeAll(NodeServices.layer, Digest.layerWebCrypto, SecureRandom.layerWebCrypto)
const traits = Array.map(["small-functions", "clear-names"], (name) =>
  Trait.make({ name: TraitName.make(name), purpose: TraitPurpose.make("Keep code understandable.") })
)
const report = Report.make({
  version: PackageJson.version,
  run: { models: [], usage: {}, ruleOut: 0.6 },
  changes: [],
  diagnostics: [],
  traits: Array.map(traits, (trait) => ({ trait, origin: TraitOrigin.cases.Programmatic.make({}), changes: [] }))
})
const config = {
  version: PackageJson.version,
  models: { language: { provider: "openai", model: "test" }, decision: { provider: "openai", model: "test" } }
}

it.live("prepares one report for the complete selection and returns instructions without an agent", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-prepare-" })
    yield* fs.makeDirectory(`${directory}/traits`)
    yield* fs.writeFileString(`${directory}/traits/_config.json`, JSON.stringify(config))
    let checks = 0
    const selection = { traits: Array.map(traits, (trait) => trait.name) }
    const result = yield* WorkspaceApply.run(selection).pipe(
      Effect.provide([
        WorkspaceRoot.layer(directory),
        Layer.succeed(
          HttpClient.HttpClient,
          HttpClient.make(() => Effect.die("Unexpected HTTP"))
        ),
        Layer.succeed(WorkspaceCheck, {
          check: (request) =>
            Effect.sync(() => {
              expect(request).toEqual(selection)
              checks++
              return { report, policy: undefined }
            })
        })
      ])
    )
    expect(checks).toBe(1)
    expect(result.execution).toBeUndefined()
    expect(result.traits).toEqual(selection.traits)
    expect(result.prompt).toContain(result.reportFile)
    const saved = yield* fs.readFileString(`${directory}/${result.reportFile}`)
    expect(JSON.parse(saved)).toEqual(report)
  }).pipe(Effect.scoped, Effect.provide(platform))
)

it.live("retries application after agent failure without re-importing or losing persisted traits", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-apply-retry-" })
    yield* fs.makeDirectory(`${directory}/traits`)
    yield* fs.writeFileString(
      `${directory}/traits/_config.json`,
      JSON.stringify({ ...config, agent: { command: "false", continue: "false", maxSteps: 1 } })
    )
    const document = TraitFile.TraitDocument.make({ name: traits[0]!.name, purpose: traits[0]!.purpose })
    const text = TraitFile.serialize(document)
    yield* fs.writeFileString(`${directory}/source.md`, text)
    let checks = 0
    const services = Layer.mergeAll(
      WorkspaceRoot.layer(directory),
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make(() => Effect.die("Unexpected HTTP"))
      ),
      Layer.succeed(WorkspaceCheck, {
        check: (request) =>
          Effect.sync(() => {
            expect(request.traits).toEqual([document.name])
            checks++
            return { report: Report.make({ ...report, traits: [report.traits[0]!] }), policy: undefined }
          })
      }),
      Layer.effect(
        DecisionModel.DecisionModel,
        DecisionModel.make({
          decide: () =>
            Effect.succeed({
              answers: { outcome: { _tag: "Classify", label: "done", probabilities: { done: 1, more: 0, input: 0 } } },
              usage: { inputTokens: undefined, outputTokens: undefined }
            })
        })
      )
    )
    yield* Effect.gen(function* () {
      const store = yield* WritableTraitStore.WritableTraitStore
      const imported = yield* store.add("source.md", { track: true })
      const failed = yield* WorkspaceApply.run({ traits: imported.traits }).pipe(Effect.flip)
      expect(failed._tag).toBe("AgentError")
      const persisted = yield* fs.readFileString(`${directory}/traits/${document.name}.md`)
      expect(persisted).toBe(text)
      yield* fs.remove(`${directory}/source.md`)
      yield* fs.writeFileString(
        `${directory}/traits/_config.json`,
        JSON.stringify({ ...config, agent: { command: "printf done", continue: "printf done", maxSteps: 1 } })
      )
      const retried = yield* WorkspaceApply.run({ traits: imported.traits })
      expect(retried.execution?._tag).toBe("Done")
      expect(checks).toBe(2)
    }).pipe(Effect.provide(WritableTraitStore.layer.pipe(Layer.provideMerge(services))))
  }).pipe(Effect.scoped, Effect.provide(platform))
)

it.effect("reports input-required execution as incomplete to CLI callers", () =>
  Effect.gen(function* () {
    const error = yield* AgentResult.report(
      CodingAgent.Result.cases.InputRequired.make({
        session: "session",
        stdout: ["traits/stdout/log"],
        output: "Which style?"
      })
    ).pipe(Effect.flip)
    expect(Runtime.getErrorExitCode(error)).toBe(2)
    expect(error.message).toContain("agent.continue")
  })
)
