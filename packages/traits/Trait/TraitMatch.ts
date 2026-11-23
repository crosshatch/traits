import { Array, Schema as S } from "effect"

import { isNonBlankPattern } from "../util/checks/isNonBlankPattern.ts"
import { matchesGlob } from "../util/matchesGlob.ts"

/** A glob pattern, relative to the workspace root, for files a trait can apply to, such as **\/*.{ts,tsx}: * matches within one name, ** across directories, and {a,b} either alternative. */
export type TraitMatchPattern = typeof TraitMatchPattern.Type
export const TraitMatchPattern = S.String.check(isNonBlankPattern, S.isMaxLength(500))
  .pipe(S.brand("traits/TraitMatchPattern"))
  .annotate({
    description:
      "A glob pattern, relative to the workspace root, for files a trait can apply to, such as **/*.{ts,tsx}: * matches within one name, ** across directories, and {a,b} either alternative."
  })

/** What a trait can apply to: one pattern, or a list of patterns of which any one is enough. */
export type TraitMatch = typeof TraitMatch.Type
export const TraitMatch = S.Union([TraitMatchPattern, S.NonEmptyArray(TraitMatchPattern)]).annotate({
  description: "What a trait can apply to: one pattern, or a list of patterns of which any one is enough."
})

/** Whether a file's path, relative to the workspace root, is one the trait can apply to. */
export const matchesFile = (match: TraitMatch): ((path: string) => boolean) => {
  const patterns = Array.map(Array.ensure(match), matchesGlob)
  return (path) => Array.some(patterns, (matches) => matches(path))
}
