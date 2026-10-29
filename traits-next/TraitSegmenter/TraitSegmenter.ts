import type { Array, Effect } from "effect"

import type { InputSegment } from "../schema/index.ts"
import type { TraitEnrichmentServices } from "../TraitEnrichment/index.ts"
import type { TraitSegmenterContext } from "./TraitSegmenterContext.ts"

/** Shared infrastructure services available during segmenter setup and execution. */
export type TraitSegmenterServices = TraitEnrichmentServices

/** Shared setup producing a nonempty segmentation of each complete input. */
export type TraitSegmenter = Effect.Effect<
  Effect.Effect<Array.NonEmptyReadonlyArray<InputSegment>, never, TraitSegmenterContext | TraitSegmenterServices>,
  never,
  TraitSegmenterServices
>
