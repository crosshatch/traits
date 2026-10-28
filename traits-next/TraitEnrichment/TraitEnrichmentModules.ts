import { Schema as S } from "effect"

import { TraitEnrichmentModule } from "./TraitEnrichmentModule.ts"

/** A nonempty, ordered list of trait enrichment module references. */
export type TraitEnrichmentModules = typeof TraitEnrichmentModules.Type
export const TraitEnrichmentModules = S.NonEmptyArray(TraitEnrichmentModule).check(S.isMaxLength(32)).annotate({
  description: "Trait enrichment module references."
})
