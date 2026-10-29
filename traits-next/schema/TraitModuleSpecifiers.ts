import { Schema as S } from "effect"

import { TraitModuleSpecifier } from "./TraitModuleSpecifier.ts"

/** A nonempty, ordered list of trait extension module references. */
export type TraitModuleSpecifiers = typeof TraitModuleSpecifiers.Type
export const TraitModuleSpecifiers = S.NonEmptyArray(TraitModuleSpecifier).check(S.isMaxLength(32)).annotate({
  description: "Trait extension module references."
})
