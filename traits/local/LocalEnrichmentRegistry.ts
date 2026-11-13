import { Effect, flow, Layer, Schema as S } from "effect"

import { type Enrichment, EnrichmentSetupError } from "../Enrichment/Enrichment.ts"
import { EnrichmentError } from "../Enrichment/EnrichmentError.ts"
import { EnrichmentRegistry } from "../Enrichment/EnrichmentRegistry.ts"
import * as ExtensionRegistry from "./ExtensionRegistry.ts"

/** Program-scoped enrichment setup from workspace modules, with invocation-local context, chat, and scope. */
export const layer = Layer.effect(
  EnrichmentRegistry,
  Effect.gen(function* () {
    const { get, run } = yield* ExtensionRegistry.make(
      S.declare((value): value is Effect.Success<Enrichment> => Effect.isEffect(value)),
      EnrichmentSetupError,
      EnrichmentError
    )
    return flow(get, Effect.map(flow(run, Effect.flatMap(S.decodeUnknownEffect(S.String)))))
  })
)
