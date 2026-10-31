import { Schema as S } from "effect"

import { ModuleSpecifier } from "../schema/index.ts"

/** An enrichment outcome; failure details live in the trait report's recoveries or diagnostics. */
export type EnrichmentReport = typeof EnrichmentReport.Type
export const EnrichmentReport = S.TaggedUnion({
  Completed: {
    /** The module that produced this input-specific context. */
    module: ModuleSpecifier,
    /** The context generated for this input, including a valid empty result. */
    text: S.String
  },
  Failed: {
    /** The module that failed; its recovery or diagnostic entry records the details. */
    module: ModuleSpecifier
  },
  Cancelled: {
    /** The module not completed because enclosing work was stopped. */
    module: ModuleSpecifier
  }
})
