import { Effect, pipe, Schema as S } from "effect"
import type { Digest } from "effect/crypto"

import type { Change } from "../util/Change.ts"
import { fromInputSource, SourceIdentity } from "./SourceIdentity.ts"

/** The original source version. */
const before = SourceIdentity.annotateKey({ description: "The original source version." })
/** The current source version. */
const after = SourceIdentity.annotateKey({ description: "The current source version." })

/** The source versions of a change, retaining both sides of renames without source text. At least one side is required: only before for a deletion, and only after for a creation. */
export type ChangeIdentity = typeof ChangeIdentity.Type
export const ChangeIdentity = S.Union([
  S.Struct({ before, after: after.pipe(S.optionalKey) }),
  S.Struct({ before: before.pipe(S.optionalKey), after })
]).annotate({
  description:
    "The source versions of a change, retaining both sides of renames without source text. At least one side is required: only before for a deletion, and only after for a creation."
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
