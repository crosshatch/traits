import { Schema as S } from "effect"

import { Fingerprint } from "./Fingerprint.ts"

/** One supplied source version identified without retaining its text. */
const SourceIdentity = S.Struct({
  /** Canonical source path within the evaluation workspace; before and after paths may differ for renames. */
  path: S.NonEmptyString.annotate({
    description: "Canonical source path within the evaluation workspace; before and after paths may differ for renames."
  }),
  /** Digest of the exact supplied source text, including empty text; not a timestamp or Git revision. */
  content: Fingerprint.annotateKey({
    description: "Digest of the exact supplied source text, including empty text; not a timestamp or Git revision."
  })
})

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
