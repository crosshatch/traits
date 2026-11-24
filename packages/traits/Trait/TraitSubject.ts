import { Schema as S } from "effect"

import { isNonBlankPattern } from "../util/checks/isNonBlankPattern.ts"

/** The kind of artifact, action, transaction, relationship, or situation to identify and assess. */
export type TraitSubject = typeof TraitSubject.Type
export const TraitSubject = S.String.check(isNonBlankPattern, S.isMaxLength(500))
  .pipe(S.brand("traits/TraitSubject"))
  .annotate({
    description: "The kind of artifact, action, transaction, relationship, or situation to identify and assess."
  })
