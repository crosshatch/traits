import type { Effect } from "effect"

import type { TraitEnrichmentContext } from "./TraitEnrichmentContext.ts"
import type { TraitEnrichmentError } from "./TraitEnrichmentError.ts"
import type { TraitEnrichmentServices } from "./TraitEnrichmentServices.ts"

/** Shared setup producing a per-input context Effect without modifying the trait body. */
export type TraitEnrichment = Effect.Effect<
  Effect.Effect<string, TraitEnrichmentError, TraitEnrichmentContext | TraitEnrichmentServices>,
  never,
  TraitEnrichmentServices
>
