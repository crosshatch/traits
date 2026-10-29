import { Context } from "effect"

import type { Snapshot } from "../schema/index.ts"

/** The complete input available during per-input segmentation. */
export class TraitSegmenterContext extends Context.Service<
  TraitSegmenterContext,
  {
    /** The file and complete contents on each side of its change. */
    readonly input: Snapshot
  }
>()("traits/TraitSegmenterContext") {}
