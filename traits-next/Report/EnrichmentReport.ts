import { Schema as S } from "effect"

import { ModuleSpecifier } from "../schema/index.ts"

/** An enrichment's generated context or explicit skipped outcome. */
export type EnrichmentReport = typeof EnrichmentReport.Type
export const EnrichmentReport = S.TaggedUnion({
  Completed: {
    /** The module that produced this input-specific context. */
    module: ModuleSpecifier,
    /** The context generated for this input, including a valid empty result. */
    text: S.String
  },
  Skipped: {
    /** The module whose execution was skipped. */
    module: ModuleSpecifier,
    /** Required recovery guidance for the skipped enrichment. */
    instruction: S.String
  }
})
