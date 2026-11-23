import { Schema as S } from "effect"

import { isKebabCaseIdPattern } from "../util/checks/isKebabCaseIdPattern.ts"

/** The kebab-case ID a workspace gives a trait source, starting with a letter, such as effect. */
export type TraitSourceId = typeof TraitSourceId.Type
export const TraitSourceId = S.String.check(isKebabCaseIdPattern).pipe(S.brand("traits/TraitSourceId")).annotate({
  description: "The kebab-case ID a workspace gives a trait source, starting with a letter, such as effect."
})
