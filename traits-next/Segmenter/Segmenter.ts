import type { Array, Effect } from "effect"

import type { InputSegment } from "../schema/index.ts"
import type { TraitServices } from "../TraitServices.ts"
import type { SegmenterContext } from "./SegmenterContext.ts"

/**
 * Shared setup producing a nonempty segmentation of each selected source version.
 * Segmentation must succeed and cannot request skips or halts.
 * The runner falls back to text-based chunking on setup or execution failures and defects,
 * preserving interruption. Binary sources fall back to a Full segment.
 */
export type Segmenter = Effect.Effect<
  Effect.Effect<Array.NonEmptyReadonlyArray<InputSegment>, never, SegmenterContext | TraitServices>,
  never,
  TraitServices
>
