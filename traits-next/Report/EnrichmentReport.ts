import { Schema as S } from "effect"

import { ModuleSpecifier } from "../schema/index.ts"

/** An enrichment outcome; failure details live in the trait report's recoveries. */
export type EnrichmentReport = typeof EnrichmentReport.Type
export const EnrichmentReport = S.TaggedUnion({
  Completed: {
    /** The module that produced this input-specific context. */
    module: ModuleSpecifier,
    /** The context generated for this input, including a valid empty result. */
    text: S.String
  },
  Failed: {
    /** The module that failed; its recovery entry records the reason and instruction. */
    module: ModuleSpecifier
  },
  Cancelled: {
    /** The module not completed because enclosing work was stopped. */
    module: ModuleSpecifier
  }
})
