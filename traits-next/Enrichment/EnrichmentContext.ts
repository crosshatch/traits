import { Context } from "effect"

import type { InputSegment, InputSource } from "../schema/index.ts"
import type { Trait } from "../Trait.ts"

/** Evaluation inputs for one trait and source location. */
export class EnrichmentContext extends Context.Service<
  EnrichmentContext,
  {
    /** The static trait definition, unchanged by enrichments. */
    readonly trait: Trait
    /** The selected file version being enriched. */
    readonly input: InputSource
    /** The complete source or text range being enriched. */
    readonly location: InputSegment
  }
>()("traits/Enrichment/EnrichmentContext") {}
