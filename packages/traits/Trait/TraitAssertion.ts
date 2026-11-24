import { Schema as S } from "effect"

import { isNonBlankPattern } from "../util/checks/isNonBlankPattern.ts"

/** The assertion to assess against the subject. */
export type TraitAssertion = typeof TraitAssertion.Type
export const TraitAssertion = S.String.check(isNonBlankPattern, S.isMaxLength(4_000))
  .pipe(S.brand("traits/TraitAssertion"))
  .annotate({
    description: "The assertion to assess against the subject."
  })
