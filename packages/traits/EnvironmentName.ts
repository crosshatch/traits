import { Schema as S } from "effect"

import { KebabCase } from "./util/KebabCase.ts"

/** The kebab-case name of an environment, starting with a letter, such as ci. */
export type EnvironmentName = typeof EnvironmentName.Type
export const EnvironmentName = KebabCase.check(S.isMaxLength(200)).pipe(S.brand("traits/EnvironmentName")).annotate({
  description: "The kebab-case name of an environment, starting with a letter, such as ci."
})
