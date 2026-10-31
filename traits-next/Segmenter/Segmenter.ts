import type { Array, Effect } from "effect"

import type { Change, Segment } from "../schema/index.ts"
import type { TraitServices } from "../TraitServices.ts"

/**
 * Shared setup producing a function that selects assessment ranges within a change.
 * Segmentation must succeed and cannot request skips or halts.
 * The runner falls back to text-based chunking on setup or execution failures and defects,
 * preserving interruption.
 */
export type Segmenter = Effect.Effect<
  (change: Change) => Effect.Effect<Array.NonEmptyReadonlyArray<Segment>, never, TraitServices>,
  never,
  TraitServices
>
