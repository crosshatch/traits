import { Schema as S } from "effect"

import { TraitName } from "../TraitName.ts"
import { ChangeIdentity } from "./ChangeIdentity.ts"
import { Dependencies } from "./Dependencies.ts"
import { Fingerprint } from "./Fingerprint.ts"
import { Outcome } from "./Outcome.ts"

/** One trait/change evaluation record; segments are evidence within this unit, not independently cached checks. */
export type Entry = typeof Entry.Type
export const Entry = S.Struct({
  /** Trait name for lookup and display; the name alone does not establish reuse eligibility. */
  trait: TraitName.annotate({
    description: "Trait name for lookup and display; the name alone does not establish reuse eligibility."
  }),
  /** Digest of the complete static trait definition. */
  definition: Fingerprint.annotate({ description: "Digest of the complete static trait definition." }),
  /** Digest of evaluator version, model/configuration, decision policy, and resolved extension implementation identities. */
  evaluation: Fingerprint.annotate({
    description:
      "Digest of evaluator version, model/configuration, decision policy, and resolved extension implementation identities."
  }),
  /** The source versions evaluated together; at least one side is required, and an absent side differs from empty text. */
  change: ChangeIdentity,
  /** Dependency evidence captured for an evaluation; incomplete coverage prohibits reuse. */
  dependencies: Dependencies,
  /** Execution completeness and assessment are independent; only a complete Pass is initially eligible for reuse. */
  outcome: Outcome
}).annotate({
  description:
    "One trait/change evaluation record; segments are evidence within this unit, not independently cached checks."
})
