import { describe, expect, it } from "@effect/vitest"
import { Array, Effect, pipe, Record, Ref, Result, Schema as S } from "effect"
import { Decision, DecisionModel } from "effect/ai"

import { assert, TraitAssertion } from "../Trait/TraitAssertion.ts"

/** A decision model that records its requests and answers the listed decisions with the given probabilities. */
const setup = Effect.fn("setup")(function* (answers: Readonly<Record<string, number>>) {
  const requests = yield* Ref.make<ReadonlyArray<DecisionModel.ProviderOptions>>([])
  const model = yield* DecisionModel.make({
    supportsImages: true,
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

const Note = S.Struct({ text: S.String })
const assertions = {
  concise: TraitAssertion.make("The note is at most one sentence."),
  polite: TraitAssertion.make("The note is polite.")
}

describe("assert", () => {
  it.effect("asks every assertion about the same content in one request", () =>
    Effect.gen(function* () {
      const { model, requests } = yield* setup({ concise: 0.9, polite: 0.2 })
      const response = yield* assert(assertions, { schema: Note, value: { text: "Thanks for the fix." } }).pipe(
        Effect.provideService(DecisionModel.DecisionModel, model)
      )
      expect(settled(response.outcomes.concise)).toBe(0.9)
      expect(settled(response.outcomes.polite)).toBe(0.2)
      expect(response.usage).toEqual(DecisionModel.DecisionUsage.make({ inputTokens: 7, outputTokens: 3 }))

      const [request, ...others] = yield* requests
      expect(others).toEqual([])
      expect(request?.state).toEqual({ text: "Thanks for the fix." })
      expect(request?.images).toBeUndefined()
      expect(Record.keys(request?.decisions ?? {})).toEqual(["concise", "polite"])
      expect(request?.decisions["polite"]).toMatchObject({
        _tag: "Probability",
        instructions: { assertion: "The note is polite." },
        criteria: {
          true: "The assertion holds true for the input.",
          false: "The assertion does not hold true for the input."
        }
      })
    })
  )

  it.effect("sends image fields to the model as images", () =>
    Effect.gen(function* () {
      const { model, requests } = yield* setup({ concise: 0.5 })
      const photo = { mediaType: "image/png", data: new Uint8Array([1, 2, 3]) }
      yield* assert(
        { concise: assertions.concise },
        {
          schema: S.Struct({ caption: S.String, photo: Decision.Image }),
          value: { caption: "A whiteboard", photo }
        }
      ).pipe(Effect.provideService(DecisionModel.DecisionModel, model))

      const [request] = yield* requests
      const [image, ...others] = request?.images ?? []
      expect(others).toEqual([])
      expect(image?.image).toEqual({ mediaType: "image/png", data: "AQID" })
      expect(request?.state).toEqual({ caption: "A whiteboard", photo: image?.reference })
    })
  )

  it.effect("keeps answered assertions when another goes unanswered", () =>
    Effect.gen(function* () {
      const { model } = yield* setup({ polite: 0.8 })
      const response = yield* assert(assertions, { schema: S.String, value: "Thanks." }).pipe(
        Effect.provideService(DecisionModel.DecisionModel, model)
      )
      expect(settled(response.outcomes.concise)).toBe("Missing")
      expect(settled(response.outcomes.polite)).toBe(0.8)
    })
  )

  it.effect("makes no request when there are no assertions", () =>
    Effect.gen(function* () {
      const { model, requests } = yield* setup({})
      const response = yield* assert({}, { schema: S.String, value: "Thanks." }).pipe(
        Effect.provideService(DecisionModel.DecisionModel, model)
      )
      expect(response.outcomes).toEqual({})
      expect(response.usage).toEqual(DecisionModel.DecisionUsage.make({ inputTokens: 0, outputTokens: 0 }))
      const made = yield* requests
      expect(made).toEqual([])
    })
  )

  it.effect("takes the content first when piped", () =>
    Effect.gen(function* () {
      const { model } = yield* setup({ concise: 0.6, polite: 0.7 })
      const response = yield* pipe(
        assertions,
        assert({ schema: S.String, value: "Thanks." }),
        Effect.provideService(DecisionModel.DecisionModel, model)
      )
      expect(settled(response.outcomes.concise)).toBe(0.6)
      expect(settled(response.outcomes.polite)).toBe(0.7)
    })
  )
})
