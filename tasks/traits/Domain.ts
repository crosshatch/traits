import { Schema as S } from "effect"

import { Target } from "./Target.ts"

export type Trait = typeof Trait.Type
export const Trait = S.Struct({ name: S.String, path: S.String, content: S.String })

export type Change = typeof Change.Type
export const Change = S.Struct({ path: S.String, content: S.String })

export type Classification = typeof Classification.Type
export const Classification = S.Literals(["compliant", "violation", "not-applicable", "inconclusive"])

export type Reason = typeof Reason.Type
export const Reason = S.Literals(["violation", "low-probability", "inconclusive"])

export type Assessment = typeof Assessment.Type
export const Assessment = S.Struct({
  classification: Classification,
  passProbability: S.Finite,
  probabilities: S.Struct({
    compliant: S.Finite,
    violation: S.Finite,
    "not-applicable": S.Finite,
    inconclusive: S.Finite
  }),
  confidence: S.optional(S.Finite)
})

export type Finding = typeof Finding.Type
export const Finding = S.Struct({
  changePath: S.String,
  name: S.String,
  path: S.String,
  reason: Reason,
  threshold: S.Finite,
  assessment: Assessment
})

export type Report = typeof Report.Type
export const Report = S.Struct({
  status: S.Literals(["pass", "violations", "inconclusive", "no-traits", "no-changes"]),
  root: S.String,
  target: Target,
  message: S.optional(S.String),
  findings: S.Array(Finding),
  checked: S.Int
})
