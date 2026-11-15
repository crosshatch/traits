import { Effect, pipe, Schema as S } from "effect"
import type { Digest } from "effect/crypto"

import type { Change } from "../util/Change.ts"
import { fromInputSource, SourceIdentity } from "./SourceIdentity.ts"

/** The source versions of a change, retaining both sides of renames without source text. At least one side is required. */
export type ChangeIdentity = typeof ChangeIdentity.Type
export const ChangeIdentity = S.Union([
  S.Struct({
    /** Original source version. */
    before: SourceIdentity.annotateKey({ description: "Original source version." }),
    /** Current source version; absent for deletions. */
    after: SourceIdentity.annotateKey({ description: "Current source version; absent for deletions." }).pipe(
      S.optionalKey
    )
  }),
  S.Struct({
    /** Original source version; absent for creations. */
    before: SourceIdentity.annotateKey({ description: "Original source version; absent for creations." }).pipe(
      S.optionalKey
    ),
    /** Current source version. */
    after: SourceIdentity.annotateKey({ description: "Current source version." })
  })
]).annotate({
  description:
    "The source versions of a change, retaining both sides of renames without source text. At least one side is required."
})

/** Identifies each source version a change supplies, so the report can name the change without retaining its text. */
export const fromChange = (change: Change): Effect.Effect<ChangeIdentity, never, Digest.Digest> =>
  change.after === undefined
    ? pipe(
        change.before!,
        fromInputSource,
        Effect.map((before) => ({ before }))
      )
    : Effect.all(
        {
          after: fromInputSource(change.after),
          ...(change.before === undefined ? {} : { before: fromInputSource(change.before) })
        },
        { concurrency: "unbounded" }
      )
