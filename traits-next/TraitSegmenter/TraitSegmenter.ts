import type { Array, Effect } from "effect"

import type { InputSegment } from "../schema/index.ts"
import type { TraitServices } from "../TraitServices.ts"
import type { TraitSegmenterContext } from "./TraitSegmenterContext.ts"

/** Shared setup producing a nonempty segmentation of each complete input. */
export type TraitSegmenter = Effect.Effect<
  Effect.Effect<Array.NonEmptyReadonlyArray<InputSegment>, never, TraitSegmenterContext | TraitServices>,
  never,
  TraitServices
>
