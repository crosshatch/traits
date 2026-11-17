import { Schema as S } from "effect"

/** Text with at least one character that is not whitespace. It carries no description, so each schema built on it describes its own meaning. */
export const NonBlankString = S.String.check(
  S.isPattern(/\S/u, { message: "Expected text with at least one character that is not whitespace." })
)
