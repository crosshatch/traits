import { Schema as S } from "effect"

import { KebabCase } from "./util/KebabCase.ts"

/** A descriptive kebab-case trait name starting with a letter, without a redundant trait- prefix. */
export type TraitName = typeof TraitName.Type
export const TraitName = KebabCase.check(
  S.isPattern(/^(?!trait-)/u, { message: "Expected a name without a redundant trait- prefix." }),
  S.isMaxLength(200)
)
  .pipe(S.brand("traits/TraitName"))
  .annotate({
    description: "A descriptive kebab-case trait name starting with a letter, without a redundant trait- prefix."
  })
