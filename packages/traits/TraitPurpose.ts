import { Schema as S } from "effect"

import { NonBlankString } from "./util/NonBlankString.ts"

/** What the trait aims to achieve or protect, and why that matters. */
export type TraitPurpose = typeof TraitPurpose.Type
export const TraitPurpose = NonBlankString.check(S.isMaxLength(2_000)).pipe(S.brand("traits/TraitPurpose")).annotate({
  description: "What the trait aims to achieve or protect, and why that matters."
})
