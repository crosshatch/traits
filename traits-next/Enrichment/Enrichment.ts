import type { Effect } from "effect"

import type { TraitServices } from "../TraitServices.ts"
import type { EnrichmentContext } from "./EnrichmentContext.ts"

/**
 * Shared setup producing a per-input context Effect without modifying the trait body.
 * Recognized enrichment errors carry explicit recovery guidance and execution scope;
 * other failures become runner-normalized diagnostics without inferred broad cancellation.
 */
export type Enrichment = Effect.Effect<
  Effect.Effect<string, unknown, EnrichmentContext | TraitServices>,
  unknown,
  TraitServices
>
