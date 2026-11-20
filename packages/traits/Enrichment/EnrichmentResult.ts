import { Schema as S } from "effect"

import { WorkspacePath } from "../util/WorkspacePath.ts"

/** Successful input-specific context produced by one enrichment module. */
export type EnrichmentResult = typeof EnrichmentResult.Type
export const EnrichmentResult = S.Struct({
  module: WorkspacePath.annotateKey({ description: "The configured enrichment module." }),
  text: S.String.annotate({ description: "Successfully generated input-specific context." })
})
