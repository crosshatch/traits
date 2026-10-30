import type { Effect } from "effect"

import type { TraitServices } from "../TraitServices.ts"
import type { EnrichmentContext } from "./EnrichmentContext.ts"
import type { EnrichmentError } from "./EnrichmentError.ts"
import type { EnrichmentSetupError } from "./EnrichmentSetupError.ts"

/**
 * Shared setup producing a per-input context Effect without modifying the trait body.
 * Failures are recovered internally or mapped to the stage-specific error contract.
 */
export type Enrichment = Effect.Effect<
  Effect.Effect<string, EnrichmentError, EnrichmentContext | TraitServices>,
  EnrichmentSetupError,
  TraitServices
>
