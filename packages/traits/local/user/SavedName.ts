import { Schema as S } from "effect"

/** Shared syntax for user-assigned account and profile names; each domain schema supplies its own description. */
export const SavedName = S.String.check(
  S.isPattern(/^[a-z0-9][a-z0-9._-]*$/u, {
    message: "Expected lowercase letters, digits, dots, underscores, or hyphens, starting with a letter or digit."
  })
)
