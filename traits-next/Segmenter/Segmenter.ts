import type { Array, Effect } from "effect"

import type { InputSegment } from "../schema/index.ts"
import type { TraitServices } from "../TraitServices.ts"
import type { SegmenterContext } from "./SegmenterContext.ts"

/** Shared setup producing a nonempty segmentation of each complete input. */
export type Segmenter = Effect.Effect<
  Effect.Effect<Array.NonEmptyReadonlyArray<InputSegment>, never, SegmenterContext | TraitServices>,
  never,
  TraitServices
>
