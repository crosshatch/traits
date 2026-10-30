import { Record, Schema as S } from "effect"

import { EnrichmentErrorReason } from "../Enrichment/index.ts"
import { InputLocation, ModuleSpecifier, RecoveryInstruction } from "../schema/index.ts"

/** One observed enrichment failure, stored once in its containing trait report. */
export type Recovery = typeof Recovery.Type
export const Recovery = S.TaggedUnion({
  Setup: {
    /** The module whose initialization failed. */
    module: ModuleSpecifier,
    /** Required recovery guidance. */
    instruction: RecoveryInstruction
  },
  Execution: {
    /** The module whose execution failed. */
    module: ModuleSpecifier,
    /** The scope of work invalidated by this failure. */
    reason: S.Literals(Record.keys(EnrichmentErrorReason.cases)),
    /** The source and validated location on which the failure originated. */
    input: InputLocation,
    /** Required recovery guidance. */
    instruction: RecoveryInstruction
  }
})
