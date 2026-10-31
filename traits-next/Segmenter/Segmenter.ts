import type { Array, Effect } from "effect"

import type { Change, Segment } from "../schema/index.ts"
import type { TraitServices } from "../TraitServices.ts"

/**
 * Initializes change-aware segmentation; skips and halts are unsupported.
 * Before enrichment, the runner validates the whole result. Setup/execution failures,
 * defects, or invalid output trigger text-chunk fallback across all available sides
 * (including empty sources), without historical mappings. Interruption never triggers fallback.
 */
export type Segmenter = Effect.Effect<
  (change: Change) => Effect.Effect<Array.NonEmptyReadonlyArray<Segment>, never, TraitServices>,
  never,
  TraitServices
>
