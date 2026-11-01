import { Schema as S } from "effect"

import { Fingerprint } from "../schema/index.ts"

/** One supplied source version identified without retaining its text. */
export type SourceIdentity = typeof SourceIdentity.Type
export const SourceIdentity = S.Struct({
  /** Canonical source path within the evaluation workspace; before and after paths may differ for renames. */
  path: S.NonEmptyString.annotate({
    description: "Canonical source path within the evaluation workspace; before and after paths may differ for renames."
  }),
  /** Digest of the exact supplied source text, including empty text; not a timestamp or Git revision. */
  content: Fingerprint.annotateKey({
    description: "Digest of the exact supplied source text, including empty text; not a timestamp or Git revision."
  })
}).annotate({ description: "One supplied source version identified without retaining its text." })
