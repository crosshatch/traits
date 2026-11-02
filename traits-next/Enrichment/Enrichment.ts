import type { Effect } from "effect"

import type { TraitServices } from "../TraitServices.ts"
import type { EnrichmentContext } from "./EnrichmentContext.ts"
import type { EnrichmentError } from "./EnrichmentError.ts"
import type { EnrichmentSetupError } from "./EnrichmentSetupError.ts"

/**
 * Shared setup producing a per-input context Effect without modifying the trait body.
 * Map expected failures to stage-specific errors with recovery guidance and execution scope.
 * Unexpected defects become runner-normalized diagnostics without inferred recovery targets.
 */
export type Enrichment = Effect.Effect<
  Effect.Effect<string, EnrichmentError, EnrichmentContext | TraitServices>,
  EnrichmentSetupError,
  TraitServices
>
