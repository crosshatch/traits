import * as Github from "@distilled.cloud/github"
import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Array, Effect, FileSystem, Layer, Stream } from "effect"
import { DecisionModel, LanguageModel } from "effect/ai"
import { Digest, SecureRandom } from "effect/crypto"
import { HttpClient, HttpClientResponse } from "effect/http"
import { vi } from "vite-plus/test"

import { EnvironmentName } from "../EnvironmentName.ts"
import * as Ingest from "../ingest.ts"
import { AgentConfiguration } from "../local/AgentConfiguration.ts"
import * as CodingAgent from "../local/CodingAgent.ts"
import * as Metadata from "../local/IngestionMetadata.ts"
import * as Source from "../local/IngestionSource.ts"
import { WorkspaceRoot } from "../local/WorkspaceRoot.ts"
import * as WritableTraitStore from "../local/WritableTraitStore.ts"
import PackageJson from "../package.json" with { type: "json" }
import * as TraitFile from "../TraitFile.ts"
import { TraitName } from "../TraitName.ts"
import { TraitPurpose } from "../TraitPurpose.ts"

const platform = Layer.mergeAll(NodeServices.layer, Digest.layerWebCrypto, SecureRandom.layerWebCrypto)
// Ingestion tests supply their own language model and exercise the real store layer.
vi.mock("../local/WorkspaceModels.ts", () => ({ layerLanguage: () => Layer.empty }))

const document = (name: string) =>
  TraitFile.TraitDocument.make({ name: TraitName.make(name), purpose: TraitPurpose.make("Keep code understandable.") })
const language = (generate: () => string) =>
  Layer.effect(
    LanguageModel.LanguageModel,
    LanguageModel.make({
      generateText: () => Effect.sync(() => [{ type: "text" as const, text: generate() }]),
      streamText: () => Stream.empty
    })
  )
const decisions = (label: () => "done" | "more" | "input") =>
  Layer.effect(
    DecisionModel.DecisionModel,
    DecisionModel.make({
      decide: () =>
        Effect.sync(() => {
          const answer = label()
          return {
            answers: {
              outcome: {
                _tag: "Classify" as const,
                label: answer,
                probabilities: {
                  done: answer === "done" ? 1 : 0,
                  more: answer === "more" ? 1 : 0,
                  input: answer === "input" ? 1 : 0
                }
              }
            },
            usage: { inputTokens: undefined, outputTokens: undefined }
          }
        })
    })
  )
const config = {
  version: PackageJson.version,
  models: { language: { provider: "openai", model: "test" }, decision: { provider: "openai", model: "test" } }
}

it.effect("extracts multiple traits and only infers malformed documents", () =>
  Effect.gen(function* () {
    let calls = 0
    yield* Effect.gen(function* () {
      const valid = yield* Ingest.parseOrExtract("valid.md", TraitFile.serialize(document("valid")))
      expect(valid.extracted).toBe(false)
      expect(calls).toBe(0)
      const inferred = yield* Ingest.parseOrExtract("rules.txt", "Keep functions short and names meaningful.")
      expect(Array.map(inferred.traits, (trait) => trait.name)).toEqual(["short-functions", "meaningful-names"])
      expect(calls).toBe(1)
    }).pipe(
      Effect.provide(
        language(() => {
          calls++
          return JSON.stringify({ traits: [document("short-functions"), document("meaningful-names")] })
        })
      )
    )
  })
)

it.effect("preserves HTTP failures rather than inferring traits from error responses", () =>
  Ingest.scrape("https://example.com/rules").pipe(
    Effect.flip,
    Effect.map((error) => expect(error._tag).toBe("HttpClientError")),
    Effect.provideService(
      HttpClient.HttpClient,
      HttpClient.make((request) =>
        Effect.succeed(HttpClientResponse.fromWeb(request, new Response("Unavailable", { status: 503 })))
      )
    )
  )
)

it.live(
  "ingests and refreshes without an agent, reuses inference, and returns installed traits even when unchanged",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-ingest-" })
      yield* fs.makeDirectory(`${directory}/traits`)
      yield* fs.writeFileString(`${directory}/traits/_config.json`, JSON.stringify(config))
      let source = "Use clear names."
      let inferred = 0
      const services = Layer.mergeAll(
        WorkspaceRoot.layer(directory),
        language(() => {
          inferred++
          return JSON.stringify({ traits: [document(`remote-${inferred}`)] })
        }),
        Layer.succeed(
          HttpClient.HttpClient,
          HttpClient.make((request) => Effect.succeed(HttpClientResponse.fromWeb(request, new Response(source))))
        )
      )
      yield* Effect.gen(function* () {
        const store = yield* WritableTraitStore.WritableTraitStore
        const added = yield* store.add("https://example.com/rules", { track: true })
        expect(added.traits).toEqual(["remote-1"])
        expect(added.changed).toEqual(["remote-1"])
        const same = yield* store.pull()
        expect(same.traits).toEqual(["remote-1"])
        expect(same.changed).toEqual([])
        expect(inferred).toBe(1)
        source = "Use clear names and short functions."
        yield* store.pull({ environments: [EnvironmentName.make("ci")] })
        expect(inferred).toBe(1)
        const updated = yield* store.pull()
        expect(updated.traits).toEqual(["remote-2"])
        expect(updated.removed).toEqual(["remote-1"])
        const selected = yield* store.add("https://example.com/rules", {
          track: true,
          environment: EnvironmentName.make("ci")
        })
        expect(selected.environmentsCreated).toEqual(["ci"])
        const output = yield* fs.exists(`${directory}/traits/stdout`)
        expect(output).toBe(false)
        const metadata = yield* Metadata.read
        expect(metadata.remotes["https://example.com/rules"]?.extracted).toBe(true)
      }).pipe(Effect.provide(WritableTraitStore.layer.pipe(Layer.provideMerge(services))))
    }).pipe(Effect.scoped, Effect.provide(platform))
)

it.live("loads immediate child directories by default and all descendants with deep", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-source-" })
    yield* fs.makeDirectory(`${directory}/rules/child/grandchild`, { recursive: true })
    for (const file of ["a", "child/b", "child/grandchild/c"]) {
      yield* fs.writeFileString(`${directory}/rules/${file}`, file)
    }
    const services = Layer.mergeAll(
      WorkspaceRoot.layer(directory),
      Github.CredentialsFromEnv,
      Github.GithubProtocol,
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make(() => Effect.die("Unexpected HTTP"))
      )
    )
    const shallow = yield* Source.load("rules").pipe(Effect.provide(services))
    const deep = yield* Source.load("rules", true).pipe(Effect.provide(services))
    expect(shallow.files).toHaveLength(2)
    expect(deep.files).toHaveLength(3)
  }).pipe(Effect.scoped, Effect.provide(platform))
)

it.live("continues bounded headless work in one session with configurable identity formatting", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-agent-" })
    let calls = 0
    const result = yield* CodingAgent.run(
      AgentConfiguration.make({
        sessionPrefix: "client_",
        command: 'printf "%s" {{session}}',
        continue: 'printf "continued:%s" {{session}}'
      }),
      "Work"
    ).pipe(Effect.provide([WorkspaceRoot.layer(directory), decisions(() => (++calls === 1 ? "more" : "done"))]))
    expect(result._tag).toBe("Done")
    expect(result.session).toMatch(/^client_/u)
    expect(result.stdout).toHaveLength(2)
    const continued = yield* fs.readFileString(`${directory}/${result.stdout[1]}`)
    expect(continued).toBe(`continued:${result.session}`)
    const failure = yield* CodingAgent.run(
      AgentConfiguration.make({ command: "printf working", continue: "printf working", maxSteps: 2 }),
      "Work"
    ).pipe(Effect.provide([WorkspaceRoot.layer(directory), decisions(() => "more")]), Effect.flip)
    expect(failure).toMatchObject({
      _tag: "AgentError",
      stdout: expect.arrayContaining([expect.stringContaining("traits/stdout/")])
    })
  }).pipe(Effect.scoped, Effect.provide(platform))
)

it.live("hands questions to the caller immediately and resumes only with the supplied answer", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-input-" })
    const config = AgentConfiguration.make({
      command: "printf 'Which style?'",
      continue: 'printf "%s %s" {{session}} {{prompt}}'
    })
    let calls = 0
    const services = Layer.mergeAll(
      WorkspaceRoot.layer(directory),
      decisions(() => (++calls === 1 ? "input" : "done"))
    )
    yield* Effect.gen(function* () {
      const waiting = yield* CodingAgent.run(config, "Work")
      expect(waiting).toMatchObject({ _tag: "InputRequired", output: "Which style?" })
      expect(calls).toBe(1)
      const resumed = yield* CodingAgent.run(config, "Use the existing style.", waiting.session)
      expect(resumed._tag).toBe("Done")
      expect(resumed.session).toBe(waiting.session)
      const text = yield* fs.readFileString(`${directory}/${resumed.stdout[0]}`)
      expect(text).toContain(`${waiting.session} Use the existing style.`)
      expect(text).toContain("This invocation is unattended.")
    }).pipe(Effect.provide(services))
  }).pipe(Effect.scoped, Effect.provide(platform))
)

it.live("reports local edits without prompting or changing the baseline, and honors explicit force", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-conflict-" })
    yield* fs.makeDirectory(`${directory}/traits`)
    yield* fs.writeFileString(`${directory}/traits/_config.json`, JSON.stringify(config))
    let source = TraitFile.serialize(document("one-rule"))
    const services = Layer.mergeAll(
      WorkspaceRoot.layer(directory),
      language(() => {
        throw new Error("Unexpected inference")
      }),
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) => Effect.succeed(HttpClientResponse.fromWeb(request, new Response(source))))
      )
    )
    yield* Effect.gen(function* () {
      const store = yield* WritableTraitStore.WritableTraitStore
      yield* store.add("https://example.com/trait", { track: true })
      const baseline = yield* Metadata.read
      yield* fs.writeFileString(`${directory}/traits/one-rule.md`, "local edits")
      source = TraitFile.serialize({ ...document("one-rule"), purpose: TraitPurpose.make("A changed purpose.") })
      const failure = yield* store.pull().pipe(Effect.flip)
      expect(failure).toMatchObject({ _tag: "LocalTraitEdits", paths: ["traits/one-rule.md"] })
      const text = yield* fs.readFileString(`${directory}/traits/one-rule.md`)
      const metadata = yield* Metadata.read
      expect(text).toBe("local edits")
      expect(metadata).toEqual(baseline)
      yield* store.pull({ force: true })
      const replaced = yield* fs.readFileString(`${directory}/traits/one-rule.md`)
      expect(replaced).toBe(source)
    }).pipe(Effect.provide(WritableTraitStore.layer.pipe(Layer.provideMerge(services))))
  }).pipe(Effect.scoped, Effect.provide(platform))
)

it.live("rejects malformed metadata instead of resetting source tracking", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-metadata-" })
    yield* fs.makeDirectory(`${directory}/traits`)
    const text = '{"remotes": {"https://example.com": {"hash": 42}}}'
    yield* fs.writeFileString(`${directory}/traits/_metadata.json`, text)
    const failure = yield* Metadata.read.pipe(Effect.provide(WorkspaceRoot.layer(directory)), Effect.flip)
    expect(failure._tag).toBe("SchemaError")
    const unchanged = yield* fs.readFileString(`${directory}/traits/_metadata.json`)
    expect(unchanged).toBe(text)
  }).pipe(Effect.scoped, Effect.provide(platform))
)
