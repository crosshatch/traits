import { Schema as S } from "effect"

/** Source paths for a change, retaining both sides of renames without source text. At least one side is required. */
export type ChangePaths = typeof ChangePaths.Type
export const ChangePaths = S.Union([
  S.Struct({
    /** Original source path. */
    before: S.NonEmptyString.annotate({ description: "Original source path." }),
    /** Current source path; absent for deletions. */
    after: S.NonEmptyString.annotate({ description: "Current source path; absent for deletions." }).pipe(S.optionalKey)
  }),
  S.Struct({
    /** Original source path; absent for creations. */
    before: S.NonEmptyString.annotate({ description: "Original source path; absent for creations." }).pipe(
      S.optionalKey
    ),
    /** Current source path. */
    after: S.NonEmptyString.annotate({ description: "Current source path." })
  })
]).annotate({
  description:
    "Source paths for a change, retaining both sides of renames without source text. At least one side is required."
})
