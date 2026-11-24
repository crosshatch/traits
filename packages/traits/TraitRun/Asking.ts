import { Array, Effect, Record, Result } from "effect"
import type { AiError, Decision } from "effect/ai"

import { hash } from "../util/hash.ts"
import * as Budget from "./Budget.ts"
import { DecisionCache } from "./DecisionCache.ts"
import type { Outcome } from "./Outcome.ts"
import type { ProbabilityResponse } from "./ProbabilityResponse.ts"
import { addUsage, fromResponse, noUsage } from "./Usage.ts"

// A provider may limit how many questions one request can hold, and a request this size still shares one copy of the file.
const questionsPerRequest = 50

const missing: Outcome = { _tag: "Unanswered", reason: "Missing", description: "The model gave no answer." }

const toOutcome = (outcome: Decision.Outcome<Decision.Probability> | undefined): Outcome =>
  outcome === undefined
    ? missing
    : Result.match(outcome, {
        onSuccess: ({ probability }): Outcome => ({ _tag: "Answered", probability }),
        // The provider's own wording for a missing answer names the question by its position in the request, which means nothing outside it.
        onFailure: ({ description, reason }): Outcome =>
          reason === "Missing" ? missing : { _tag: "Unanswered", reason, description }
      })

/** Asks the model the questions, by the ID that sets each apart from the others asked about the same evidence, and returns each one's outcome with what asking cost. Answers the model gave before to the same question about the same evidence are taken from the decision cache rather than asked for again, and new answers are added to it. The rest are asked a limited number per request, and a request that fails leaves its questions unanswered rather than failing the rest, as does one that the run's budget has no room for. */
export const ask = Effect.fnUntraced(function* <Q, R>(options: {
  readonly questions: Readonly<Record<string, Q>>
  /** Everything the questions share: how they are put to the model, and the evidence they are about. */
  readonly shared: unknown
  readonly request: (questions: Readonly<Record<string, Q>>) => Effect.Effect<ProbabilityResponse, AiError.AiError, R>
}) {
  const { recall, remember } = yield* DecisionCache
  // What is remembered goes by everything the questions share, so a change to how they are put, or to the evidence, asks again.
  const key = yield* hash(options.shared)
  const remembered = yield* recall(key)
  const unasked = Array.filter(Record.toEntries(options.questions), ([id]) => !Record.has(remembered, id))
  const asked = yield* Effect.forEach(
    Array.chunksOf(unasked, questionsPerRequest),
    Effect.fnUntraced(function* (chunk) {
      // Keys are positions, since a provider may not accept every character an ID can hold.
      const position = (index: number) => `t${index}`
      const sent = yield* Budget.within(
        options.request(Record.fromEntries(Array.map(chunk, ([, question], index) => [position(index), question])))
      ).pipe(
        Effect.map(
          Result.match({
            onFailure: (reason) => ({
              outcome: (): Outcome => ({ _tag: "Unanswered", reason: "OverBudget", description: reason }),
              usage: noUsage
            }),
            onSuccess: (response) => ({
              outcome: (index: number) => toOutcome(response.outcomes[position(index)]),
              usage: fromResponse(response)
            })
          })
        ),
        Effect.catchTag("AiError", (error) =>
          Effect.succeed({
            outcome: (): Outcome => ({ _tag: "Unanswered", reason: "Failed", description: error.message }),
            usage: { ...noUsage, requests: 1 }
          })
        )
      )
      return {
        outcomes: Array.map(chunk, ([id], index) => [id, sent.outcome(index)] as const),
        usage: sent.usage
      }
    }),
    { concurrency: "unbounded" }
  )
  const outcomes: Readonly<Record<string, Outcome>> = Record.fromEntries(
    Array.flatMap(asked, (chunk) => chunk.outcomes)
  )
  const learned = Record.fromEntries(
    Array.flatMap(Record.toEntries(outcomes), ([id, outcome]) =>
      outcome._tag === "Answered" ? [[id, outcome.probability] as const] : []
    )
  )
  if (!Record.isEmptyRecord(learned)) {
    yield* remember(key, { ...remembered, ...learned })
  }
  return {
    /** The outcome of the question with this ID. */
    outcome: (id: string): Outcome => {
      const probability = remembered[id]
      return probability === undefined ? (outcomes[id] ?? missing) : { _tag: "Answered", probability }
    },
    usage: Array.reduce(
      asked,
      { ...noUsage, remembered: Record.size(options.questions) - unasked.length },
      (total, chunk) => addUsage(total, chunk.usage)
    )
  }
})
