import { Effect, Record } from "effect"
import { DecisionModel } from "effect/ai"

// About what the supported providers' tokenizers come to for source code and prose; the last real run measured 4.0.
const charactersPerToken = 4

/** A stand-in for the model that is never really asked anything: it gives every question this probability, and reports as used the tokens its request would have taken. */
export const make = (probability: number) =>
  DecisionModel.make({
    decide: (request) =>
      Effect.succeed({
        answers: Record.map(request.decisions, () => ({ _tag: "Probability" as const, probability })),
        usage: { inputTokens: Math.ceil(JSON.stringify(request).length / charactersPerToken), outputTokens: 0 }
      })
  })
