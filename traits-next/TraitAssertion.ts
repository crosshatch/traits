import { Schema as S } from "effect"

export type TraitAssertion = typeof TraitAssertion.Type
export const TraitAssertion = S.NonEmptyString.check(S.isPattern(/\S/), S.isMaxLength(4_000))
  .pipe(S.brand("traits/TraitAssertion"))
  .annotate({
    description: "The assertion to assess against the subject."
  })
