import { Context, Effect, flow, Layer, Schema as S } from "effect"

import * as ExtensionRegistry from "../ExtensionRegistry.ts"
import type { Enrichment } from "./Enrichment.ts"
import { EnrichmentError } from "./EnrichmentError.ts"
import { EnrichmentSetupError } from "./EnrichmentSetupError.ts"

/** Program-scoped enrichment setup with invocation-local context, chat, and scope. */
export class EnrichmentRegistry extends Context.Service<EnrichmentRegistry>()(
  "traits-next/Enrichment/EnrichmentRegistry",
  {
    make: Effect.gen(function* () {
      const registry = yield* ExtensionRegistry.make(
        S.declare((value): value is Effect.Success<Enrichment> => Effect.isEffect(value)),
        EnrichmentSetupError,
        EnrichmentError
      )
      return flow(registry.get, Effect.map(registry.run))
    })
  }
) {
  static readonly layer = this.make.pipe(Layer.effect(this))
}
