import { Schema as S } from "effect"

import { isKebabCasePattern } from "../util/checks/isKebabCasePattern.ts"

/** A descriptive kebab-case trait name starting with a letter, without a redundant trait- prefix. */
export type TraitName = typeof TraitName.Type
export const TraitName = S.String.check(isKebabCasePattern, S.isMaxLength(200))
  .pipe(S.brand("traits/TraitName"))
  .annotate({
    description: "A descriptive kebab-case trait name starting with a letter, without a redundant trait- prefix."
  })
