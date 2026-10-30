import { Schema as S } from "effect"

import { ModuleSpecifier } from "./ModuleSpecifier.ts"

/** A nonempty, ordered list of distinct module references. */
export type ModuleSpecifiers = typeof ModuleSpecifiers.Type
export const ModuleSpecifiers = S.NonEmptyArray(ModuleSpecifier).check(S.isMaxLength(32), S.isUnique()).annotate({
  description: "Module references."
})
