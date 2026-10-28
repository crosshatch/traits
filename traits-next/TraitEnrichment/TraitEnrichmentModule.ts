import { Schema as S } from "effect"

/** A local script or package reference identifying an enrichment module. */
export type TraitEnrichmentModule = typeof TraitEnrichmentModule.Type
export const TraitEnrichmentModule = S.NonEmptyString.check(
  S.isTrimmed(),
  S.isPattern(/^[^\r\n\u2028\u2029]+$/u),
  S.isMaxLength(2_048)
).pipe(S.brand("traits/TraitEnrichmentModule"))
