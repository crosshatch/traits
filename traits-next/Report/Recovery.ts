import { Record, Schema as S } from "effect"

import { EnrichmentErrorReason } from "../Enrichment/index.ts"
import { ModuleSpecifier, RecoveryInstruction } from "../schema/index.ts"

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
    /** Report-local index into the containing trait report's inputs. */
    input: S.Natural,
    /** Required recovery guidance. */
    instruction: RecoveryInstruction
  }
})
