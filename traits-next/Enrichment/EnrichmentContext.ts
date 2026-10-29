import { Context } from "effect"

import type { Snapshot } from "../schema/Snapshot.ts"
import type { Trait } from "../Trait.ts"

/** Evaluation inputs for one trait–input pair. */
export class EnrichmentContext extends Context.Service<
  EnrichmentContext,
  {
    /** The static trait definition, unchanged by enrichments. */
    readonly trait: Trait
    /** The file and its creation, update, or deletion contents. */
    readonly input: Snapshot
  }
>()("traits-next/Enrichment/EnrichmentContext") {}
