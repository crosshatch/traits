import { Schema as S } from "effect"

import { isKebabCaseIdPattern } from "../util/checks/isKebabCaseIdPattern.ts"

/** The kebab-case ID of a selection of traits, starting with a letter, such as ci. */
export type TraitSelectionId = typeof TraitSelectionId.Type
export const TraitSelectionId = S.String.check(isKebabCaseIdPattern).pipe(S.brand("traits/TraitSelectionId")).annotate({
  description: "The kebab-case ID of a selection of traits, starting with a letter, such as ci."
})

/** The ID of the selection that runs when a run names none. */
export const defaultTraitSelectionId = TraitSelectionId.make("default")
