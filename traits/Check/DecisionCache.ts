import { Context, Effect, Option, pipe, Result, Schema as S, Struct } from "effect"
import { DecisionModel } from "effect/ai"

import * as DecisionState from "../DecisionState.ts"
import PackageJson from "../package.json" with { type: "json" }
import { Assessment } from "../Report/Assessment.ts"
import { SubjectMatch } from "../Report/SubjectMatch.ts"
import { CurrentSettings } from "../Settings.ts"
import * as TraitAssertion from "../TraitAssertion.ts"
import * as TraitSubject from "../TraitSubject.ts"
import type { Input } from "../util/Input.ts"
import { digestText, TextDigest } from "../util/TextDigest.ts"
import * as Resampling from "./Resampling.ts"

/** A decision a model completed, kept so the same question is not asked again. */
export type CachedDecision = typeof CachedDecision.Type
export const CachedDecision = S.Struct({
  /** The label the model chose. */
  label: S.String.annotateKey({ description: "The label the model chose." }),
  /** The model's probability for each label. */
  probabilities: S.Record(S.String, S.Finite).annotateKey({ description: "The model's probability for each label." }),
  /** The model that made the decision, when its provider reported one. */
  modelId: S.String.annotateKey({
    description: "The model that made the decision, when its provider reported one."
  }).pipe(S.optionalKey)
}).annotate({ description: "A decision a model completed, kept so the same question is not asked again." })

/** Remembers completed subject and assertion decisions by a digest of everything that determines them; hosts scope keys to their decision model. Lookups and writes never fail a check: a broken cache behaves as empty. */
export class DecisionCache extends Context.Service<
  DecisionCache,
  {
    /** The decision stored under key, if any. */
    readonly get: (key: TextDigest) => Effect.Effect<Option.Option<CachedDecision>>
    /** Stores a completed decision under key. */
    readonly set: (key: TextDigest, decision: CachedDecision) => Effect.Effect<void>
  }
>()("traits/Check/DecisionCache") {}

/** What a cached subject decision must still be to be reused: one of the labels subject decisions are asked for, with their probabilities. */
const SubjectAnswer = S.Struct({
  label: S.Literals(Struct.keys(TraitSubject.question.criteria)),
  probabilities: SubjectMatch
})

/** What a cached assertion decision must still be to be reused: one of the labels assertion assessments are asked for, with their probabilities. */
const AssertionAnswer = S.Struct({
  label: S.Literals(Struct.keys(TraitAssertion.question.criteria)),
  probabilities: Assessment
})

/** A stand-in for the response a cached decision came from: it used no tokens, but keeps the model that made it. */
const cachedResponse = (decision: CachedDecision) => ({
  usage: DecisionModel.DecisionUsage.make({ inputTokens: 0, outputTokens: 0 }),
  metadata: {},
  ...(decision.modelId === undefined ? {} : { modelId: decision.modelId })
})

/** Looks up a decision of the given answer shape; undefined when the entry is missing or no longer matches the shape. */
const lookup = <A>(cache: DecisionCache["Service"], key: TextDigest, answer: S.ConstraintDecoder<A>) =>
  Effect.map(cache.get(key), (stored) =>
    pipe(
      stored,
      Option.flatMap((decision) =>
        Option.map(pipe(decision, S.decodeOption(answer)), (decoded) => ({ decision, answer: decoded }))
      ),
      Option.getOrUndefined
    )
  )

/** Stores a successful outcome; failures are never cached, so they are retried on the next check. */
const remember = (
  cache: DecisionCache["Service"],
  key: TextDigest,
  outcome: Result.Result<{ readonly label: string; readonly probabilities: Readonly<Record<string, number>> }, unknown>,
  modelId: string | undefined
) =>
  Result.isFailure(outcome)
    ? Effect.void
    : cache.set(key, {
        label: outcome.success.label,
        probabilities: outcome.success.probabilities,
        ...(modelId === undefined ? {} : { modelId })
      })

/**
 * The decisions about one input, each reusing a cached decision when one exists, and otherwise asking the model and
 * settling a close call by asking again (Resampling.settle). The input's decision state is digested once, when a
 * decision first needs its key, and every decision about the input keys on that digest, so checking many traits against
 * one input does not digest its text once per trait. Keys also cover the thresholds and resampling settings a decision
 * was settled with, so changing them asks again.
 */
export const forInput = Effect.fnUntraced(function* (input: Input) {
  const cache = yield* Effect.serviceOption(DecisionCache).pipe(Effect.map(Option.getOrUndefined))
  const {
    check: { ruleOut, policy = { fail: 0.5, pass: 0.5 }, resampling }
  } = yield* CurrentSettings
  const settleSubject = (subject: TraitSubject.TraitSubject) =>
    Resampling.settle("subject", TraitSubject.match({ subject }, input), (probabilities) =>
      Math.abs(probabilities.no - ruleOut)
    )
  const settleAssertion = (assertion: TraitAssertion.TraitAssertionInput) =>
    Resampling.settle("assertion", TraitAssertion.evaluate({ assertion }, input), (probabilities) =>
      Math.min(
        Math.abs(probabilities.fail - policy.fail),
        Math.abs(probabilities.pass + probabilities.na - policy.pass)
      )
    )
  const state = yield* Effect.cached(digestText(JSON.stringify(DecisionState.fromInput(input))))
  /** Digests a decision's kind, the question it is asked, and its inputs with the traits version, so changed wording or schemas never reuse old answers. */
  const keyOf = (kind: "subject" | "assertion", material: unknown) =>
    Effect.flatMap(state, (state) => digestText(JSON.stringify([PackageJson.version, kind, material, state])))
  return {
    /** Decides a subject on the input like TraitSubject.match. */
    decideSubject: Effect.fn("DecisionCache.decideSubject")(function* (subject: TraitSubject.TraitSubject) {
      if (cache === undefined) {
        return yield* settleSubject(subject)
      }
      const key = yield* keyOf("subject", [TraitSubject.question, subject, ruleOut, resampling])
      const hit = yield* lookup(cache, key, SubjectAnswer)
      if (hit !== undefined) {
        return {
          ...cachedResponse(hit.decision),
          outcomes: { subject: Result.succeed(hit.answer) }
        } satisfies TraitSubject.TraitSubjectMatches<"subject">
      }
      const response = yield* settleSubject(subject)
      yield* remember(cache, key, response.outcomes.subject, response.modelId)
      return response
    }),
    /** Assesses one assertion on the input like TraitAssertion.evaluate. */
    evaluateAssertion: Effect.fn("DecisionCache.evaluateAssertion")(function* (
      assertion: TraitAssertion.TraitAssertionInput
    ) {
      if (cache === undefined) {
        return yield* settleAssertion(assertion)
      }
      const key = yield* keyOf("assertion", [TraitAssertion.question, assertion, policy, resampling])
      const hit = yield* lookup(cache, key, AssertionAnswer)
      if (hit !== undefined) {
        return {
          ...cachedResponse(hit.decision),
          outcomes: { assertion: Result.succeed(hit.answer) }
        } satisfies TraitAssertion.TraitAssertionEvaluations<"assertion">
      }
      const response = yield* settleAssertion(assertion)
      yield* remember(cache, key, response.outcomes.assertion, response.modelId)
      return response
    })
  }
})
