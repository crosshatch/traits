import { Effect } from "effect"
import { DecisionModel } from "effect/ai"

import { type Assessment, type Change, type Finding, type Reason, type Report, type Trait } from "./Domain.ts"
import * as Target from "./Target.ts"
import * as CheckTraits from "./tools/CheckTraits.ts"
import * as Traits from "./Traits.ts"
import { TraitsContext } from "./TraitsContext.ts"

const reviewTrait = Effect.fn("traits.reviewTrait")(function* (change: Change, trait: Trait) {
  const {
    config: { passThreshold: threshold }
  } = yield* TraitsContext
  const input = { trait, change }
  const result = yield* DecisionModel.decide(CheckTraits.decision, { input })
  const answer = result.answers.assessment
  const assessment: Assessment = {
    classification: answer.label,
    passProbability: answer.probabilities.compliant + answer.probabilities["not-applicable"],
    probabilities: answer.probabilities,
    confidence: answer.confidence
  }
  let reason: Reason | undefined
  if (answer.label === "violation" || answer.label === "inconclusive") reason = answer.label
  else if (assessment.passProbability < threshold) reason = "low-probability"
  const finding: Finding | undefined =
    reason === undefined
      ? undefined
      : {
          name: trait.name,
          path: trait.path,
          changePath: change.path,
          reason,
          threshold,
          assessment
        }
  return finding
})

export const check = Effect.fn("traits.check")(function* ({
  traitName,
  target = { _tag: "Staged" }
}: { readonly traitName?: string; readonly target?: Target.Target } = {}) {
  const { root } = yield* TraitsContext
  const changes = yield* Target.normalize(target)
  const loaded = yield* Traits.load()
  const selected = loaded.filter((trait) => traitName === undefined || trait.name === traitName)
  const empty = {
    root,
    target,
    findings: [],
    checked: 0
  }
  if (selected.length === 0)
    return {
      ...empty,
      status: traitName === undefined ? "no-traits" : "inconclusive",
      ...(traitName === undefined ? {} : { message: `Trait ${traitName} is missing` })
    } satisfies Report
  if (changes.length === 0) return { ...empty, status: "no-changes" } satisfies Report
  const results = (yield* Effect.forEach(
    selected,
    (trait) => Effect.forEach(changes, (change) => reviewTrait(change, trait), { concurrency: "unbounded" }),
    { concurrency: "unbounded" }
  )).flat()
  const findings = results.filter((finding) => finding !== undefined)
  const incomplete = findings.some((finding) => finding.reason !== "violation")
  let status: Report["status"] = incomplete ? "inconclusive" : "pass"
  if (findings.some((finding) => finding.reason === "violation")) status = "violations"
  return {
    root,
    target,
    status,
    findings,
    checked: results.length
  } satisfies Report
})
