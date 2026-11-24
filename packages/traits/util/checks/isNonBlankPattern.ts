import { Schema as S } from "effect"

export const isNonBlankPattern = S.isPattern(/\S/u, {
  message: "Expected text with at least one character that is not whitespace."
})
