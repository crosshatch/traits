import { Array, Option, pipe, Schema as S } from "effect"

/** A policy-derived result: Fail found a violation, Incomplete could not finish required work, Inconclusive lacked a confident assessment, and Pass satisfied the policy. */
export type Verdict = typeof Verdict.Type
export const Verdict = S.Literals(["Pass", "Fail", "Inconclusive", "Incomplete"]).annotate({
  description:
    "A policy-derived result: Fail found a violation, Incomplete could not finish required work, Inconclusive lacked a confident assessment, and Pass satisfied the policy."
})

/** Combines verdicts by precedence Fail, Incomplete, Inconclusive, then Pass; empty input passes. */
export const combineVerdicts = (verdicts: ReadonlyArray<Verdict>): Verdict =>
  pipe(
    ["Fail", "Incomplete", "Inconclusive"] as const,
    Array.findFirst((verdict) => Array.contains(verdicts, verdict)),
    Option.getOrElse((): Verdict => "Pass")
  )
