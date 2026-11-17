import { Context, Effect, flow, Layer, Schema as S, type Scope } from "effect"
import type { Chat } from "effect/ai"

import * as ExtensionRegistry from "../util/ExtensionRegistry.ts"
import type { WorkspacePath } from "../util/WorkspacePath.ts"
import type { EnrichmentError, EnrichmentSetupError } from "./Enrichment.ts"
import * as Enrichment from "./Enrichment.ts"
import type { EnrichmentContext } from "./EnrichmentContext.ts"

/** Program-scoped enrichment setup with invocation-local context, chat, and scope. */
export class EnrichmentRegistry extends Context.Service<
  EnrichmentRegistry,
  (
    module: WorkspacePath
  ) => Effect.Effect<
    Effect.Effect<string, EnrichmentError | S.SchemaError, EnrichmentContext>,
    EnrichmentSetupError | S.SchemaError
  >
>()("traits/Enrichment/EnrichmentRegistry") {}

/** Builds a scoped registry without filesystem loading. Setup is shared and each execution gets a fresh chat and scope; only declared extension services are required. */
export const layer = <R>(
  setup: (
    module: WorkspacePath
  ) => Effect.Effect<
    Effect.Effect<string, EnrichmentError, R | Scope.Scope | Chat.Chat | EnrichmentContext>,
    EnrichmentSetupError | S.SchemaError,
    R | Scope.Scope | Chat.Chat
  >
) =>
  Layer.effect(
    EnrichmentRegistry,
    Effect.gen(function* () {
      const { get, run } = yield* ExtensionRegistry.make(setup, Enrichment.EnrichmentError)
      return flow(get, Effect.map(flow(run, Effect.flatMap(S.decodeUnknownEffect(S.String)))))
    })
  )
