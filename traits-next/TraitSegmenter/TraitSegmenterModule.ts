import { Schema as S } from "effect"

/** A local script or package reference identifying a trait segmenter. */
export type TraitSegmenterModule = typeof TraitSegmenterModule.Type
export const TraitSegmenterModule = S.NonEmptyString.check(
  S.isTrimmed(),
  S.isPattern(/^[^\r\n\u2028\u2029]+$/u),
  S.isMaxLength(2_048)
)
  .pipe(S.brand("traits/TraitSegmenterModule"))
  .annotate({
    description: "Trait segmenter module reference."
  })
