import { Context } from "effect"

import type { Snapshot } from "../schema/index.ts"

/** The complete input available during per-input segmentation. */
export class SegmenterContext extends Context.Service<
  SegmenterContext,
  {
    /** The file and complete contents on each side of its change. */
    readonly input: Snapshot
  }
>()("traits-next/Segmenter/SegmenterContext") {}
