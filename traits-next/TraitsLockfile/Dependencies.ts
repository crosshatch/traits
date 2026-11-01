import { Schema as S } from "effect"

import { Fingerprint } from "./Fingerprint.ts"

/** Dependency evidence captured for an evaluation; incomplete coverage prohibits reuse. */
export type Dependencies = typeof Dependencies.Type
export const Dependencies = S.Struct({
  /** Whether every result-affecting dependency was captured and can be revalidated; false for untracked or unverifiable state. */
  complete: S.Boolean.annotate({
    description:
      "Whether every result-affecting dependency was captured and can be revalidated; false for untracked or unverifiable state."
  }),
  /** Observed dependency versions, including any captured before an incomplete evaluation; empty does not imply complete coverage. */
  entries: S.Array(
    S.Struct({
      /** Canonical resource identity understood by the dependency resolver, such as a file URL; never a credential. */
      resource: S.NonEmptyString.annotate({
        description:
          "Canonical resource identity understood by the dependency resolver, such as a file URL; never a credential."
      }),
      /** Digest of the observed dependency state; creation, deletion, and absence must invalidate dependent checks. */
      fingerprint: Fingerprint.annotate({
        description:
          "Digest of the observed dependency state; creation, deletion, and absence must invalidate dependent checks."
      })
    })
  ).annotate({
    description:
      "Observed dependency versions, including any captured before an incomplete evaluation; empty does not imply complete coverage."
  })
}).annotate({ description: "Dependency evidence captured for an evaluation; incomplete coverage prohibits reuse." })
