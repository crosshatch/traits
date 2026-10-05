import { ConfigProvider, Effect, Layer, Logger, String } from "effect"
import { McpProtocol, McpServer, Toolkit } from "effect/ai"
import { Command } from "effect/cli"
import { FetchHttpClient } from "effect/http"

import * as CheckTraits from "./tools/CheckTraits.ts"
import * as CreateTrait from "./tools/CreateTrait.ts"
import { TraitsContext } from "./TraitsContext.ts"

export const traits = Command.make("traits").pipe(
  Command.withDescription("Run the traits MCP server over stdio"),
  Command.withHandler(
    Effect.fn("tasks.traits")(function* () {
      const registrations = McpServer.toolkit(Toolkit.merge(CreateTrait.toolkit, CheckTraits.toolkit)).pipe(
        Layer.provide(Layer.merge(CreateTrait.layer, CheckTraits.layer))
      )
      return yield* registrations.pipe(
        Layer.provide(
          McpServer.layerStdio({
            name: "traits",
            version: "1.0.0",
            protocols: [McpProtocol.v2025_11_25],
            instructions: String.stripMargin(`
              | Use create-trait for explicit requests or approved insights.
              | Preview drafted wording and get approval; an explicit request with exact name and text counts as approval.
              | Keep trait text minimal: preserve essential rules, scopes, and exceptions; omit headings,
              | repetition, and unnecessary explanation or examples. Every word adds evaluation cost.
              | Creation checks all existing traits first.
              | If reconciliation is required, propose reuse, clarified scopes or a merged trait,
              | showing full text and any removals.
              | Ask for approval/revision using an interactive question when available, otherwise text.
              | Do not silently rewrite existing traits.
              | After saving, inspect the automatic all-changes review and report incomplete results.
              | Findings are trait-level; inspect the diff to locate violations.
              | Before committing, stage intended changes and call check-traits;
              | fix findings and rerun after staging changes.
            `)
          })
        ),
        Layer.provide(
          TraitsContext.pipe(
            Effect.map(({ config }) => config.layerDecisionModel),
            Layer.unwrap
          )
        ),
        Layer.provide(FetchHttpClient.layer),
        Layer.provide(
          Layer.effect(
            ConfigProvider.ConfigProvider,
            TraitsContext.pipe(Effect.map(({ configProvider }) => configProvider))
          )
        ),
        Layer.provide(TraitsContext.layer),
        Layer.launch,
        Effect.provideService(Logger.LogToStderr, true)
      )
    })
  )
)
