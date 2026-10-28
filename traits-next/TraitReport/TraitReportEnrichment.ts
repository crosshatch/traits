import { Schema as S } from "effect"

import { TraitEnrichmentModule } from "../TraitEnrichment/index.ts"

export type TraitReportEnrichment = typeof TraitReportEnrichment.Type
export const TraitReportEnrichment = S.Struct({
  /** The module that produced this input-specific context. */
  module: TraitEnrichmentModule,
  /** The context generated for this input. */
  text: S.String
})
