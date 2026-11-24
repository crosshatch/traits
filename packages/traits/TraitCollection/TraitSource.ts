import { Effect, Schema as S } from "effect"

import { isNonBlankPattern } from "../util/checks/isNonBlankPattern.ts"
import { isNotGitOptionPattern } from "../util/checks/isNotGitOptionPattern.ts"

// Traits from a directory of a Git repository, at a branch, tag, or commit.
export type GitTraitSource = typeof GitTraitSource.Type
export const GitTraitSource = S.Struct({
  /** A repository Git can clone, as a URL or a path, such as https://github.com/crosshatch/traits. */
  git: S.String.check(isNonBlankPattern, isNotGitOptionPattern, S.isMaxLength(2_000)).annotateKey({
    description: "A repository Git can clone, as a URL or a path, such as https://github.com/crosshatch/traits."
  }),
  /** The branch, tag, or commit to take the traits from; the repository's default branch when omitted. */
  ref: S.String.check(isNonBlankPattern, isNotGitOptionPattern, S.isMaxLength(500))
    .annotateKey({
      description: "The branch, tag, or commit to take the traits from; the repository's default branch when omitted."
    })
    .pipe(S.optionalKey),
  /** The directory within the repository holding the trait files; traits when omitted, and . for the repository's root. */
  path: S.String.check(
    S.isPattern(/^(?!\/)(?!(?:.*\/)?\.\.(?:\/|$))[^\\]+$/u, {
      message: "Expected a relative path without .. segments or backslashes."
    }),
    S.isMaxLength(2_000)
  )
    .annotateKey({
      description:
        "The directory within the repository holding the trait files; traits when omitted, and . for the repository's root."
    })
    .pipe(S.withDecodingDefaultKey(Effect.succeed("traits")))
}).annotate({ description: "Traits from a directory of a Git repository, at a branch, tag, or commit." })

// Traits from a directory on this machine.
export type DirectoryTraitSource = typeof DirectoryTraitSource.Type
export const DirectoryTraitSource = S.Struct({
  /** A directory of trait files, as an absolute path or one relative to the workspace root. */
  directory: S.String.check(isNonBlankPattern, S.isMaxLength(2_000)).annotateKey({
    description: "A directory of trait files, as an absolute path or one relative to the workspace root."
  })
}).annotate({ description: "Traits from a directory on this machine." })

/** Where a collection of traits comes from: a Git repository, or a directory of trait files. */
export type TraitSource = typeof TraitSource.Type
export const TraitSource = S.Union([GitTraitSource, DirectoryTraitSource]).annotate({
  description: "Where a collection of traits comes from: a Git repository, or a directory of trait files."
})
