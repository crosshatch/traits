import type { Effect } from "effect"

import type { TraitServices } from "../TraitServices.ts"
import type { TraitEnrichmentContext } from "./TraitEnrichmentContext.ts"
import type { TraitEnrichmentError } from "./TraitEnrichmentError.ts"

/** Shared setup producing a per-input context Effect without modifying the trait body. */
export type TraitEnrichment = Effect.Effect<
  Effect.Effect<string, TraitEnrichmentError, TraitEnrichmentContext | TraitServices>,
  never,
  TraitServices
>
