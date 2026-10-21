import { fileURLToPath } from "node:url"

import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Effect, FileSystem, Path, pipe, Queue, Schema as S, Stream, String } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

import * as Trait from "../Trait.ts"

const effectUrl = new URL("../../node_modules/effect/dist/index.js", import.meta.url).href
const aiUrl = new URL("../../node_modules/effect/dist/ai/index.js", import.meta.url).href
const server = fileURLToPath(new URL("../main.ts", import.meta.url))

it.effect(
  "returns handler defects as MCP errors and cached trait findings as valid JSON",
  Effect.fn("test.ToolErrorsMcp")(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "traits-tool-errors-" })
    yield* spawner.exitCode(ChildProcess.make("git", ["init", "--quiet"], { cwd }))
    const configSource = String.stripMargin(`
    |import { Effect, Layer, Record, Redacted } from ${JSON.stringify(effectUrl)};
    |import { DecisionModel } from ${JSON.stringify(aiUrl)};
    |export default {
    |  excludeGitignored: false,
    |  layerDecisionModel: Layer.effect(DecisionModel.DecisionModel, DecisionModel.make({
    |    decide: (options) => JSON.stringify(options.state).includes("serialize-success")
    |      ? Effect.succeed({
    |          answers: Record.map(options.decisions, () => ({
    |            _tag: "Classify", label: "violation",
    |            probabilities: { compliant: 0, violation: 1, "not-applicable": 0, inconclusive: 0 }
    |          })),
    |          usage: { inputTokens: undefined, outputTokens: undefined }
    |        })
    |      : Effect.die(Object.assign(new Error("model adapter failed"), { apiKey: Redacted.make("test-secret") }))
    |  })),
    |  layerLanguageModel: Layer.empty
    |};
    `)
    yield* fs.writeFileString(path.join(cwd, "traits.ts"), configSource)
    const trait = Trait.Trait.make({
      name: Trait.TraitName.make("existing"),
      subject: "Bindings.",
      requirement: "Prefer const.",
      purpose: "Keep bindings immutable."
    })
    yield* fs.makeDirectory(path.join(cwd, ".agents/traits"), { recursive: true })
    yield* fs.writeFileString(path.join(cwd, ".agents/traits/existing.md"), Trait.serialize(trait))
    yield* fs.writeFileString(path.join(cwd, "input.ts"), "const value = 1\n")
    const requests = yield* Queue.unbounded<string>()
    const responses = yield* Queue.unbounded<string>()
    const child = yield* spawner.spawn(
      ChildProcess.make(process.execPath, [server], {
        cwd,
        stdin: Stream.fromQueue(requests).pipe(Stream.encodeText),
        stderr: "inherit"
      })
    )
    yield* child.stdout.pipe(
      Stream.decodeText(),
      Stream.splitLines,
      Stream.runForEach((line) => Queue.offer(responses, line)),
      Effect.forkScoped
    )
    const request = Effect.fn("test.ToolErrorsMcp.request")(function* (
      id: number,
      method: string,
      params: unknown = {}
    ) {
      yield* Queue.offer(requests, `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`)
      while (true) {
        const text = yield* Queue.take(responses)
        const response = yield* pipe(
          text,
          S.decodeEffect(
            S.fromJsonString(
              S.Struct({
                id: S.Int.pipe(S.optional),
                result: S.Unknown.pipe(S.optional)
              })
            )
          )
        )
        if (response.id === id) return response.result
      }
    })
    yield* request(1, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "test", version: "1" }
    })
    yield* Queue.offer(requests, `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`)
    for (const tool of [
      { name: "check_traits", arguments: { include: ["input.ts"] } },
      { name: "derive_trait", arguments: { proposedTrait: { ...trait, name: "proposed" } } }
    ]) {
      const response = yield* request(tool.name === "check_traits" ? 2 : 3, "tools/call", tool)
      expect(response).toMatchObject({ isError: true, content: [{ type: "text" }] })
      const serialized = JSON.stringify(response)
      expect(serialized).toContain("ToolExecutionError")
      expect(serialized).toContain("model adapter failed")
      expect(serialized).not.toContain("test-secret")
    }
    const ping = yield* request(4, "ping")
    expect(ping).toEqual({})
    yield* fs.writeFileString(path.join(cwd, "input.ts"), "// serialize-success\nconst value = 1\n")
    const successful = yield* request(5, "tools/call", { name: "check_traits", arguments: { include: ["input.ts"] } })
    expect(successful).toMatchObject({ isError: false })
    expect(JSON.stringify(successful)).toContain(trait.name)
    expect(JSON.stringify(successful)).toContain(trait.requirement)
    const files = yield* fs.readDirectory(path.join(cwd, ".agents/traits"))
    expect(files).not.toContain("proposed.md")
  }, Effect.provide(NodeServices.layer)),
  { timeout: 20000 }
)
