import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai"
import { TypeSafeClient, TypeSafeDecisionModel } from "@effect/ai-typesafe"
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Config, Effect, Layer, Logger, String } from "effect"
import { McpProtocol, McpServer } from "effect/ai"
import { Command } from "effect/cli"
import { FetchHttpClient } from "effect/http"

import * as TraitsConfigProvider from "./_util/TraitsConfigProvider.ts"
import { toolkit } from "./toolkit/toolkit.ts"
import { TraitsContext } from "./TraitsContext.ts"
import { layerFileSystem } from "./TraitStore.ts"

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
      Layer.provideMerge(McpServer.McpServer.layer),
      (registrations) =>
        McpServer.layerStdio({
          name: "traits",
          version: "0.0.0",
          protocols: [McpProtocol.v2025_11_25],
          instructions: String.stripMargin(`
          | Traits are durable, reusable coding preferences stored as .agents/traits/<three_words-uuid>.md in the working directory.
          | The full filename stem is the trait ID; use it in tool calls, for example rose_karate_frog-<uuid>.
          | When the user corrects your approach or expresses a reusable preference, consider saving a trait without waiting for the word "trait".
          | Also act on explicit requests to remember a convention. Skip one-off requirements, transient facts, and preferences already covered.
          | Read existing trait files before drafting. Keep each trait concise and independently applicable, preserving scope and exceptions.
          | Call derive_trait with the drafted body as proposedTrait. It checks conflicts and writes immediately when none are returned.
          | Returned Fail entries mean nothing was saved; inspect their trait bodies and IDs before choosing a resolution.
          | Fail can also mean an inconclusive comparison. Clarify ambiguity rather than treating every failure as a proven contradiction.
          | To intentionally replace conflicting traits, call resolve_conflicting_traits with their IDs and the proposed body.
          | Resolution gives the proposal precedence in direct conflicts, writes generated replacements, then removes the selected originals.
          | Review the returned replacement bodies and IDs. Resolution already saves the proposal's content; do not derive it again.
          | After generating or changing TypeScript files, call check_trait_expression on those files.
          | After saving or resolving a trait, check the relevant TypeScript files explicitly; creation does not run that review for you.
          | Omit traitIds for all traits; use specific IDs for focused follow-ups. Before committing or opening a PR, review the changed TypeScript files.
          | Checks read current full files in 200-line chunks, not Git diffs. A finding's startLine locates a chunk, not an exact violation.
          | Inspect findings against their trait and source; fix relevant violations and rerun affected files. Report unresolved ambiguity or tool errors.
          | An empty result only means no failures for the selected files and traits; empty selections or an empty store perform no assessments.
          | On mutation errors, inspect the store before retrying: writes and removals are not transactional, and retries may duplicate saved traits.
          `)
        }).pipe(Layer.provide(registrations)),
      Layer.launch,
      Effect.provideService(Logger.LogToStderr, true)
    )
  ),
  Command.run({ version: "0.0.0" }),
  Effect.provide(TraitsConfigProvider.layer.pipe(Layer.provideMerge(NodeServices.layer))),
  NodeRuntime.runMain
)
