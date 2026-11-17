import { Schema as S } from "effect"

import { SavedName } from "../_common.ts"

/** A profile identifier starting with a lowercase letter or digit, followed by lowercase letters, digits, dots, underscores, or hyphens. */
export type ProfileName = typeof ProfileName.Type
export const ProfileName = SavedName.pipe(S.brand("traits/ProfileName")).annotate({
  description:
    "A profile identifier starting with a lowercase letter or digit, followed by lowercase letters, digits, dots, underscores, or hyphens."
})
