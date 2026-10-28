import { Context } from "effect"

import type { SnapshotChange } from "../schema/SnapshotChange.ts"
import type { Trait } from "../Trait.ts"

/** Evaluation inputs for one trait–input pair. */
export class TraitEnrichmentContext extends Context.Service<
  TraitEnrichmentContext,
  {
    /** The static trait definition, unchanged by enrichments. */
    readonly trait: Trait
    /** The snapshots being evaluated; either may be absent for additions or deletions. */
    readonly input: SnapshotChange
  }
>()("traits/TraitEnrichmentContext") {}
