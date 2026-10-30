import { Context } from "effect"

import type { InputSource } from "../schema/index.ts"

/** The complete input available during per-input segmentation. */
export class SegmenterContext extends Context.Service<
  SegmenterContext,
  {
    /** The selected file version to segment; diff selection happens before segmentation. */
    readonly input: InputSource
  }
>()("traits/Segmenter/SegmenterContext") {}
