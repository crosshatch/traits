import { Schema as S } from "effect"

/** The kind of artifact, action, or situation governed by the trait. */
export type TraitSubject = typeof TraitSubject.Type
export const TraitSubject = S.NonEmptyString.check(S.isPattern(/\S/), S.isMaxLength(500))
  .pipe(S.brand("traits/TraitSubject"))
  .annotate({
    description: "The kind of artifact, action, transaction, relationship, or situation to identify and assess."
  })
