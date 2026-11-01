import { Schema as S } from "effect"

import { Fingerprint } from "../schema/index.ts"
import { TraitName } from "../TraitName.ts"
import { ChangeIdentity } from "./ChangeIdentity.ts"
import { CheckResult } from "./CheckResult.ts"

/** One trait/change evaluation record; segments are evidence within this unit, not independently cached checks. */
export type TraitsLockEntry = typeof TraitsLockEntry.Type
export const TraitsLockEntry = S.Struct({
  /** Trait name for lookup and display; the name alone does not establish reuse eligibility. */
  trait: TraitName.annotateKey({
    description: "Trait name for lookup and display; the name alone does not establish reuse eligibility."
  }),
  /** Digest of the complete static trait definition, evaluator version, model/configuration, decision policy, and resolved extension implementation identities. */
  configuration: Fingerprint.annotateKey({
    description:
      "Digest of the complete static trait definition, evaluator version, model/configuration, decision policy, and resolved extension implementation identities."
  }),
  /** The source versions evaluated together; at least one side is required, and an absent side differs from empty text. */
  change: ChangeIdentity,
  /** Runner-derived check result combining execution success and assessment policy; only Pass is eligible for reuse under the runner's invalidation policy. */
  result: CheckResult
}).annotate({
  description:
    "One trait/change evaluation record; segments are evidence within this unit, not independently cached checks."
})
