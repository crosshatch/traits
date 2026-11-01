import { Schema as S } from "effect"

import { ModuleSpecifier } from "../schema/index.ts"

/** Successful enrichment context only; failed, cancelled, and unstarted work has no entry here. */
export type EnrichmentReport = typeof EnrichmentReport.Type
export const EnrichmentReport = S.Struct({
  /** The configured enrichment module that successfully produced this context. */
  module: ModuleSpecifier.annotateKey({
    description: "The configured enrichment module that successfully produced this context."
  }),
  /** Successfully generated input-specific context, including a valid empty string. */
  text: S.String.annotate({
    description: "Successfully generated input-specific context, including a valid empty string."
  })
}).annotate({
  description: "Successful enrichment context only; failed, cancelled, and unstarted work has no entry here."
})
