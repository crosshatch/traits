import { Schema as S } from "effect"

import { ModuleSpecifier } from "../schema/index.ts"

/** Successfully generated enrichment context; failures are reported separately. */
export type EnrichmentReport = typeof EnrichmentReport.Type
export const EnrichmentReport = S.Struct({
  /** The configured enrichment module. */
  module: ModuleSpecifier,
  /** The generated context, including a valid empty result. */
  text: S.String
})
