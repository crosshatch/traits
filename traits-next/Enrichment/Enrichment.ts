import type { Effect } from "effect"

import type { TraitServices } from "../TraitServices.ts"
import type { EnrichmentContext } from "./EnrichmentContext.ts"
import type { EnrichmentError } from "./EnrichmentError.ts"

/**
 * Shared setup producing a per-input context Effect without modifying the trait body.
 * Both stages handle operational failures internally or map them to EnrichmentError.
 */
export type Enrichment = Effect.Effect<
  Effect.Effect<string, EnrichmentError, EnrichmentContext | TraitServices>,
  EnrichmentError,
  TraitServices
>
