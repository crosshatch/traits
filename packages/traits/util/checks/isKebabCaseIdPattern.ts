import { Schema as S } from "effect"

/** A kebab-case ID of at most 200 characters: lowercase letters and digits in hyphen-separated parts, starting with a letter. The length is part of the pattern because an ID that keys a record must have a single check for the record's shape to reach the generated JSON Schema. It carries no description, so each ID built on it describes its own meaning. */
export const isKebabCaseIdPattern = S.isPattern(/^(?=.{1,200}$)[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u, {
  message:
    "Expected a kebab-case ID of at most 200 characters: lowercase letters and digits in hyphen-separated parts, starting with a letter."
})
