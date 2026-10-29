import { Schema as S } from "effect"

import { TraitModuleSpecifier } from "../schema/index.ts"

/** Input-specific context paired with the enrichment module that produced it. */
export type TraitReportEnrichment = typeof TraitReportEnrichment.Type
export const TraitReportEnrichment = S.Struct({
  /** The module that produced this input-specific context. */
  module: TraitModuleSpecifier,
  /** The context generated for this input. */
  text: S.String
})
