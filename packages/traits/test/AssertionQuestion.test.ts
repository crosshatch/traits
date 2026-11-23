import { describe, expect, it } from "@effect/vitest"
import { Array, Effect, pipe, Record, Ref, Result } from "effect"
import { type Decision, DecisionModel } from "effect/ai"

import { TraitAssertion } from "../Trait/TraitAssertion.ts"
import { TraitBody } from "../Trait/TraitBody.ts"
import { assert } from "../TraitRun/AssertionQuestion.ts"
import type { Evidence } from "../TraitRun/Evidence.ts"

/** A decision model that records its requests and answers the listed decisions with the given probabilities. */
const setup = Effect.fn("setup")(function* (answers: Readonly<Record<string, number>>) {
  const requests = yield* Ref.make<ReadonlyArray<DecisionModel.ProviderOptions>>([])
  const model = yield* DecisionModel.make({
    supportsImages: false,
    decide: (request) =>
      Ref.update(requests, Array.append<DecisionModel.ProviderOptions>(request)).pipe(
        Effect.as({
          answers: Record.map(answers, (probability) => ({ _tag: "Probability" as const, probability })),
          usage: { inputTokens: 7, outputTokens: 3 }
        })
      )
  })
  return { requests: Ref.get(requests), model }
})

/** The probability an assertion holds, or why it went unanswered. */
const settled = (outcome: Decision.Outcome<Decision.Probability>) =>
  Result.match(outcome, { onSuccess: ({ probability }) => probability, onFailure: ({ reason }) => reason })

const evidence: Evidence = { location: "notes/thanks.md", version: "after", target: "Thanks for the fix." }
const assertions = {
  concise: { assertion: TraitAssertion.make("The note is at most one sentence.") },
  polite: {
    assertion: TraitAssertion.make("The note is polite."),
    body: TraitBody.make("A curt note can still be polite.")
  }
}

describe("assert", () => {
  it.effect(
    "asks every assertion about the same evidence in one request, with the task once and each trait's context",
    () =>
      Effect.gen(function* () {
        const { model, requests } = yield* setup({ concise: 0.9, polite: 0.2 })
        const response = yield* assert(assertions, evidence).pipe(
          Effect.provideService(DecisionModel.DecisionModel, model)
        )
        expect(settled(response.outcomes.concise)).toBe(0.9)
        expect(settled(response.outcomes.polite)).toBe(0.2)
        expect(response.usage).toEqual(DecisionModel.DecisionUsage.make({ inputTokens: 7, outputTokens: 3 }))

        const [request, ...others] = yield* requests
        expect(others).toEqual([])
        expect(request?.state).toMatchObject({ content: evidence })
        expect(request?.state).toHaveProperty("task")
        expect(Record.keys(request?.decisions ?? {})).toEqual(["concise", "polite"])
        expect(request?.decisions["polite"]).toMatchObject({
          _tag: "Probability",
          instructions: { assertion: "The note is polite.", context: "A curt note can still be polite." },
          criteria: { true: "Holds.", false: "Does not hold." }
        })
        expect(request?.decisions["concise"]?.instructions).toEqual({ assertion: "The note is at most one sentence." })
      })
  )

  it.effect("keeps answered assertions when another goes unanswered", () =>
    Effect.gen(function* () {
      const { model } = yield* setup({ polite: 0.8 })
      const response = yield* assert(assertions, evidence).pipe(
        Effect.provideService(DecisionModel.DecisionModel, model)
      )
      expect(settled(response.outcomes.concise)).toBe("Missing")
      expect(settled(response.outcomes.polite)).toBe(0.8)
    })
  )

  it.effect("makes no request when there are no assertions", () =>
    Effect.gen(function* () {
      const { model, requests } = yield* setup({})
      const response = yield* assert({}, evidence).pipe(Effect.provideService(DecisionModel.DecisionModel, model))
      expect(response.outcomes).toEqual({})
      expect(response.usage).toEqual(DecisionModel.DecisionUsage.make({ inputTokens: 0, outputTokens: 0 }))
      const made = yield* requests
      expect(made).toEqual([])
    })
  )

  it.effect("takes the evidence first when piped", () =>
    Effect.gen(function* () {
      const { model } = yield* setup({ concise: 0.6, polite: 0.7 })
      const response = yield* pipe(
        assertions,
        assert(evidence),
        Effect.provideService(DecisionModel.DecisionModel, model)
      )
      expect(settled(response.outcomes.concise)).toBe(0.6)
      expect(settled(response.outcomes.polite)).toBe(0.7)
    })
  )
})
