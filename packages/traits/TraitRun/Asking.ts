import { Array, Cause, Effect, Record, Result } from "effect"
import type { AiError, Decision } from "effect/ai"
import type { Digest } from "effect/crypto"

import type { StorageError } from "../StorageError.ts"
import { Probability } from "../util/Probability.ts"
import * as Budget from "./Budget.ts"
import { type Answers, DecisionCache } from "./DecisionCache.ts"
import type { DecisionKey } from "./DecisionKey.ts"
import type { Outcome } from "./Outcome.ts"
import type { ProbabilityResponse } from "./ProbabilityResponse.ts"
import type { QuestionId } from "./QuestionId.ts"
import { addUsage, fromResponse, noUsage } from "./Usage.ts"

// A provider may limit how many questions one request can hold, and a request this size still shares one copy of the file.
const questionsPerRequest = 50

const missing: Outcome = { _tag: "Unanswered", reason: "Missing", description: "The model gave no answer." }

const toOutcome = (outcome: Decision.Outcome<Decision.Probability> | undefined): Outcome =>
  outcome === undefined
    ? missing
    : Result.match(outcome, {
        onSuccess: ({ probability }): Outcome => ({ _tag: "Answered", probability: Probability.make(probability) }),
        // The provider's own wording for a missing answer names the question by its position in the request, which means nothing outside it.
        onFailure: ({ description, reason }): Outcome =>
          reason === "Missing" ? missing : { _tag: "Unanswered", reason, description }
      })

/** Says what the decision cache could not do, and why, where asking carries on without it. */
const warn = (message: string) => (error: StorageError) => Effect.logWarning(message, Cause.fail(error))

/** Asks the model the questions, by the ID that sets each apart from the others asked about the same evidence, and returns each one's outcome with what asking cost. Answers the model gave before to the same question about the same evidence are taken from the decision cache rather than asked for again, and new answers are added to it. Remembering is only a saving, so when the cache cannot be read or added to, a warning says so and the questions are asked all the same. The rest are asked a limited number per request, and a request that fails, or that could not be made, such as for want of what a prelude finds, leaves its questions unanswered rather than failing the rest, as does one that the run's budget, once reached, leaves unasked. */
export const ask = Effect.fnUntraced(function* <
  Q,
  E extends { readonly _tag: string; readonly message: string },
  R
>(options: {
  readonly questions: Readonly<Record<QuestionId, Q>>
  /** What the answers are remembered under: everything the questions share, which is how they are put to the model and the evidence they are about. It is only worked out when there is a question to ask. */
  readonly key: Effect.Effect<DecisionKey, never, Digest.Digest>
  readonly request: (
    questions: Readonly<Record<string, Q>>
  ) => Effect.Effect<ProbabilityResponse, AiError.AiError | E, R>
}) {
  // No trait may apply to what is checked, which leaves nothing to ask and so nothing to look up.
  if (Record.isEmptyRecord(options.questions)) {
    return { outcome: (): Outcome => missing, usage: noUsage }
  }
  const { recall, remember } = yield* DecisionCache
  const key = yield* options.key
  const remembered = yield* recall(key).pipe(
    Effect.tapError(warn("What the model answered before could not be read, so it is asked again.")),
    Effect.orElseSucceed((): Answers => ({}))
  )
  const unasked = Array.filter(Record.toEntries(options.questions), ([id]) => !Record.has(remembered, id))
  const asked = yield* Effect.forEach(
    Array.chunksOf(unasked, questionsPerRequest),
    Effect.fnUntraced(function* (chunk) {
      // Keys are positions, since a provider may not accept every character an ID can hold.
      const position = (index: number) => `t${index}`
      const sent = yield* Budget.within(
        options.request(Record.fromEntries(Array.map(chunk, ([, question], index) => [position(index), question]))),
        (response) => fromResponse(response).cost
      ).pipe(
        Effect.map((response) => ({
          outcome: (index: number) => toOutcome(response.outcomes[position(index)]),
          usage: fromResponse(response)
        })),
        Effect.catch((error) =>
          Effect.succeed({
            outcome: (): Outcome => ({
              _tag: "Unanswered",
              reason: error._tag === "OverBudget" ? "OverBudget" : "Failed",
              description: error.message
            }),
            // Only a request that reached the provider was made of it.
            usage: error._tag === "AiError" ? { ...noUsage, requests: 1 } : noUsage
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
  const outcomes: Readonly<Record<QuestionId, Outcome>> = Record.fromEntries(
    Array.flatMap(asked, (chunk) => chunk.outcomes)
  )
  const learned: Answers = Record.fromEntries(
    Array.flatMap(Record.toEntries(outcomes), ([id, outcome]) =>
      outcome._tag === "Answered" ? [[id, outcome.probability] as const] : []
    )
  )
  if (!Record.isEmptyRecord(learned)) {
    yield* remember(key, learned).pipe(
      Effect.tapError(warn("What the model answered could not be kept, so it is asked again next time.")),
      Effect.ignore
    )
  }
  return {
    /** The outcome of the question with this ID. */
    outcome: (id: QuestionId): Outcome => {
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
