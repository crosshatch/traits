import { Schema as S } from "effect"

/** Arbitrary relevant context in the trait's Markdown body. */
export type TraitBody = typeof TraitBody.Type
export const TraitBody = S.String.check(S.isPattern(/^(?:$|[\s\S]*\S[\s\S]*)$/u), S.isMaxLength(1_000_000))
  .pipe(S.brand("traits/TraitBody"))
  .annotate({
    description: "Arbitrary relevant context."
  })
