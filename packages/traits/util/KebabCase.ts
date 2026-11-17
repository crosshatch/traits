import { Schema as S } from "effect"

/** A kebab-case identifier: lowercase letters and digits in hyphen-separated parts, starting with a letter. It carries no description, so each name built on it describes its own meaning. */
export const KebabCase = S.String.check(
  S.isPattern(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u, {
    message:
      "Expected a kebab-case identifier: lowercase letters and digits in hyphen-separated parts, starting with a letter."
  })
)
