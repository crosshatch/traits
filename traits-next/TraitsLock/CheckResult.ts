import { Schema as S } from "effect"

/** Runner-derived check result combining execution success and assessment policy; only Pass is eligible for reuse under the runner's invalidation policy. */
export type CheckResult = typeof CheckResult.Type
export const CheckResult = S.Literals(["Pass", "Fail", "Inconclusive", "Incomplete"]).annotate({
  description:
    "Runner-derived check result combining execution success and assessment policy; only Pass is eligible for reuse under the runner's invalidation policy."
})
