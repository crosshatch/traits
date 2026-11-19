import { Schema as S } from "effect"

import { SavedName } from "../SavedName.ts"

/** A saved account identifier starting with a lowercase letter or digit, followed by lowercase letters, digits, dots, underscores, or hyphens. */
export type AccountName = typeof AccountName.Type
export const AccountName = SavedName.pipe(S.brand("traits/AccountName")).annotate({
  description:
    "A saved account identifier starting with a lowercase letter or digit, followed by lowercase letters, digits, dots, underscores, or hyphens."
})
