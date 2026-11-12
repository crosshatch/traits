import { Context, Effect, Option, pipe, Result, Schema as S } from "effect"
import { DecisionModel } from "effect/ai"

import PackageJson from "../package.json" with { type: "json" }
import * as TraitAssertion from "../TraitAssertion.ts"
import * as TraitSubject from "../TraitSubject.ts"
import { decisionState, type Input, TextDigest } from "../util/util.ts"

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
    readonly get: (key: TextDigest.TextDigest) => Effect.Effect<Option.Option<CachedDecision>>
    /** Stores a completed decision under key. */
    readonly set: (key: TextDigest.TextDigest, decision: CachedDecision) => Effect.Effect<void>
  }
>()("traits/Check/DecisionCache") {}

/** Digests a decision's kind and inputs with the traits version, so changed prompts or schemas never reuse old answers. */
const keyOf = (kind: "subject" | "assertion", material: unknown) =>
  TextDigest.make(JSON.stringify([PackageJson.version, kind, material]))

/** A stand-in for the response a cached decision came from: it used no tokens, but keeps the model that made it. */
const cachedResponse = (decision: CachedDecision) => ({
  usage: DecisionModel.DecisionUsage.make({ inputTokens: 0, outputTokens: 0 }),
  metadata: {},
  ...(decision.modelId === undefined ? {} : { modelId: decision.modelId })
})

/** Looks up a decision of the given answer shape; undefined without a cache, or when the entry is missing or no longer matches the shape. */
const lookup = Effect.fnUntraced(function* <A>(key: TextDigest.TextDigest, answer: S.ConstraintDecoder<A>) {
  const cache = yield* Effect.serviceOption(DecisionCache).pipe(Effect.map(Option.getOrUndefined))
  if (cache === undefined) {
    return undefined
  }
  const stored = yield* cache.get(key)
  return pipe(
    stored,
    Option.flatMap((decision) =>
      Option.map(S.decodeOption(answer)(decision), (decoded) => ({ decision, answer: decoded }))
    ),
    Option.getOrUndefined
  )
})

/** Stores a successful outcome; failures are never cached, so they are retried on the next check. */
const remember = Effect.fnUntraced(function* (
  key: TextDigest.TextDigest,
  outcome: Result.Result<{ readonly label: string; readonly probabilities: Readonly<Record<string, number>> }, unknown>,
  modelId: string | undefined
) {
  const cache = yield* Effect.serviceOption(DecisionCache).pipe(Effect.map(Option.getOrUndefined))
  if (cache === undefined || Result.isFailure(outcome)) {
    return
  }
  yield* cache.set(key, {
    label: outcome.success.label,
    probabilities: outcome.success.probabilities,
    ...(modelId === undefined ? {} : { modelId })
  })
})

/** Decides a subject on an input like TraitSubject.decide, reusing a cached decision when one exists. */
export const decideSubject = Effect.fn("DecisionCache.decideSubject")(function* (
  subject: TraitSubject.TraitSubject,
  input: Input
) {
  const key = yield* keyOf("subject", [subject, decisionState(input)])
  const hit = yield* lookup(
    key,
    S.Struct({
      label: S.Literals(["yes", "no", "uncertain"]),
      probabilities: TraitSubject.TraitSubjectMatch
    })
  )
  if (hit !== undefined) {
    return {
      response: { ...cachedResponse(hit.decision), outcomes: {} },
      outcome: Result.succeed(hit.answer)
    } satisfies TraitSubject.TraitSubjectDecision
  }
  const decided = yield* TraitSubject.decide(subject, input)
  yield* remember(key, decided.outcome, decided.response.modelId)
  return decided
})

/** Assesses one assertion on an input like TraitAssertion.evaluate, reusing a cached decision when one exists. */
export const evaluateAssertion = Effect.fn("DecisionCache.evaluateAssertion")(function* (
  assertion: TraitAssertion.TraitAssertionInput,
  input: Input
) {
  const key = yield* keyOf("assertion", [assertion, decisionState(input)])
  const hit = yield* lookup(
    key,
    S.Struct({
      label: S.Literals(["pass", "fail", "na", "uncertain"]),
      probabilities: S.Struct({ pass: S.Finite, fail: S.Finite, na: S.Finite, uncertain: S.Finite })
    })
  )
  if (hit !== undefined) {
    return {
      ...cachedResponse(hit.decision),
      outcomes: { assertion: Result.succeed(hit.answer) }
    } satisfies TraitAssertion.TraitAssertionEvaluations<"assertion">
  }
  const response = yield* TraitAssertion.evaluate({ assertion }, input)
  yield* remember(key, response.outcomes.assertion, response.modelId)
  return response
})
