import type { Array, Effect } from "effect"

import type { Change, Segment } from "../schema/index.ts"
import type { TraitServices } from "../TraitServices.ts"

/**
 * Initializes change-aware segmentation; failures are reported and stop dependent work.
 * Stage-appropriate SegmenterSetupError and SegmenterError failures supply actionable
 * instructions without a recovery target. Both error channels accept arbitrary failures.
 * Before enrichment, the runner validates the whole result. Setup/execution failures,
 * defects, or invalid output prevent enrichment and assessment for affected changes.
 * No replacement segments are synthesized. Interruption is cancellation, not an extension failure.
 */
export type Segmenter = Effect.Effect<
  (change: Change) => Effect.Effect<Array.NonEmptyReadonlyArray<Segment>, unknown, TraitServices>,
  unknown,
  TraitServices
>
