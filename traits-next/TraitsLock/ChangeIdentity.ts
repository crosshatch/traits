import { Schema as S } from "effect"

import { SourceIdentity } from "./SourceIdentity.ts"

/** The source versions evaluated together; at least one side is required, and an absent side differs from empty text. */
export type ChangeIdentity = typeof ChangeIdentity.Type
export const ChangeIdentity = S.Struct({
  /** Historical source identity, including the old path for a rename; omitted for creation. */
  before: SourceIdentity.annotateKey({
    description: "Historical source identity, including the old path for a rename; omitted for creation."
  }).pipe(S.optionalKey),
  /** Updated source identity; omitted for deletion. */
  after: SourceIdentity.annotateKey({ description: "Updated source identity; omitted for deletion." }).pipe(
    S.optionalKey
  )
})
  .annotate({
    description:
      "The source versions evaluated together; at least one side is required, and an absent side differs from empty text."
  })
  .check(
    S.makeFilter((change) => change.before !== undefined || change.after !== undefined, {
      message: "A change identity requires a before or after source."
    })
  )
