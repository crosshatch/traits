import type { Array, Effect } from "effect"

import type { InputRange, InputSource } from "../schema/index.ts"
import type { TraitServices } from "../TraitServices.ts"

/**
 * Shared setup producing a function that segments each selected source version.
 * Segmentation must succeed and cannot request skips or halts.
 * The runner falls back to text-based chunking on setup or execution failures and defects,
 * preserving interruption.
 */
export type Segmenter = Effect.Effect<
  (input: InputSource) => Effect.Effect<Array.NonEmptyReadonlyArray<InputRange>, never, TraitServices>,
  never,
  TraitServices
>
