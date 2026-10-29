import { Schema as S } from "effect"

import { ModuleSpecifier } from "../schema/index.ts"

/** Input-specific context paired with the enrichment module that produced it. */
export type EnrichmentReport = typeof EnrichmentReport.Type
export const EnrichmentReport = S.Struct({
  /** The module that produced this input-specific context. */
  module: ModuleSpecifier,
  /** The context generated for this input. */
  text: S.String,
  /** Recovery guidance when this enrichment was skipped. */
  instruction: S.String.pipe(S.optionalKey)
})
