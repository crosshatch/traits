import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai"
import { TypeSafeClient, TypeSafeDecisionModel } from "@effect/ai-typesafe"
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Config, ConfigProvider, Effect, FileSystem, Layer, Logger, Path } from "effect"
import { McpProtocol, McpServer } from "effect/ai"
import { Command } from "effect/cli"
import { FetchHttpClient } from "effect/http"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

import { toolkit } from "./toolkit/toolkit.ts"
import { TraitsContext } from "./TraitsContext.ts"
import { layerFileSystem } from "./TraitStore.ts"

const layerConfig = ConfigProvider.layerAdd(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const root = (yield* spawner.string(ChildProcess.make`git rev-parse --show-toplevel`)).trim()
    const gitDir = (yield* spawner.string(
      ChildProcess.make`git rev-parse --path-format=absolute --git-common-dir`
    )).trim()
    const files = new Set([path.join(root, ".env"), path.join(path.dirname(gitDir), ".env")])
    let provider = ConfigProvider.fromUnknown({})
    for (const file of files) {
      if (yield* fs.exists(file)) {
        provider = ConfigProvider.orElse(provider, yield* ConfigProvider.fromDotEnv({ path: file }))
      }
    }
    return provider
  })
)

Command.make("traits").pipe(
  Command.withDescription("Run the traits MCP server over stdio"),
  Command.withHandler(() =>
    toolkit.pipe(
      Layer.provide(layerFileSystem(".agents/traits")),
      Layer.provide(TraitsContext.layer),
      Layer.provide(
        OpenAiLanguageModel.layer({ model: "gpt-4.1" }).pipe(
          Layer.provide(OpenAiClient.layerConfig({ apiKey: Config.Redacted("OPENAI_API_KEY") })),
          Layer.provide(FetchHttpClient.layer)
        )
      ),
      Layer.provide(
        TypeSafeDecisionModel.layer({ model: "jev-latest" }).pipe(
          Layer.provide(TypeSafeClient.layerConfig()),
          Layer.provide(FetchHttpClient.layer)
        )
      ),
      Layer.provide(
        McpServer.layerStdio({
          name: "traits",
          version: "0.0.0",
          protocols: [McpProtocol.v2025_11_25],
          instructions: "Use the available tools to manage traits."
        })
      ),
      Layer.launch,
      Effect.provideService(Logger.LogToStderr, true)
    )
  ),
  Command.run({ version: "0.0.0" }),
  Effect.provide(layerConfig.pipe(Layer.provideMerge(NodeServices.layer))),
  NodeRuntime.runMain
)
