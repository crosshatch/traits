import type { Effect } from "effect"

import type { ExtensionServices } from "../ExtensionServices.ts"
import type { Change, Segment } from "../util/index.ts"
import type { SegmenterError } from "./SegmenterError.ts"
import type { SegmenterSetupError } from "./SegmenterSetupError.ts"

/**
 * Initializes trait-independent segmentation; an empty result selects no targets without diagnostics.
 * The runner validates all segments before enrichment. Failures, defects, or invalid output
 * are reported and block dependent work without fallback. Map expected failures to the
 * stage-specific error, providing instructions rather than recovery scopes.
 * Interruption is cancellation, not an extension failure.
 */
export type Segmenter = Effect.Effect<
  (change: Change) => Effect.Effect<ReadonlyArray<Segment>, SegmenterError, ExtensionServices>,
  SegmenterSetupError,
  ExtensionServices
>
