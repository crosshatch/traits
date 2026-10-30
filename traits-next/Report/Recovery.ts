import { Record, Schema as S } from "effect"

import { EnrichmentErrorReason } from "../Enrichment/index.ts"
import { InputSegment, InputSource, ModuleSpecifier } from "../schema/index.ts"

/** One observed enrichment failure, stored once in its containing trait report. */
export type Recovery = typeof Recovery.Type
export const Recovery = S.TaggedUnion({
  Setup: {
    /** The module whose initialization failed. */
    module: ModuleSpecifier,
    /** Required recovery guidance. */
    instruction: S.String
  },
  Execution: {
    /** The module whose execution failed. */
    module: ModuleSpecifier,
    /** The scope of work invalidated by this failure. */
    reason: S.Literals(Record.keys(EnrichmentErrorReason.cases)),
    /** The source on which the failure originated. */
    source: InputSource,
    /** The location on which the failure originated. */
    location: InputSegment,
    /** Required recovery guidance. */
    instruction: S.String
  }
})
