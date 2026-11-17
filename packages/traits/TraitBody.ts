import { Schema as S } from "effect"

import { NonBlankString } from "./util/NonBlankString.ts"

/** Arbitrary relevant context in the trait's Markdown body. */
export type TraitBody = typeof TraitBody.Type
export const TraitBody = NonBlankString.check(S.isMaxLength(1_000_000)).pipe(S.brand("traits/TraitBody")).annotate({
  description: "Arbitrary relevant context in the trait's Markdown body."
})
