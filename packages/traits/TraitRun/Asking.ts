import { Array, Effect, Predicate, Record, Result } from "effect"
import type { AiError, Decision } from "effect/ai"

import { hash } from "../util/hash.ts"
import * as Budget from "./Budget.ts"
import { DecisionCache } from "./DecisionCache.ts"
import type { Outcome } from "./Outcome.ts"
import type { ProbabilityResponse } from "./ProbabilityResponse.ts"
import { addUsage, noUsage } from "./Usage.ts"

// A provider may limit how many questions one request can hold, and a request this size still shares one copy of the file.
const questionsPerRequest = 50

const toOutcome = (outcome: Decision.Outcome<Decision.Probability> | undefined): Outcome =>
  outcome === undefined
    ? { _tag: "Unanswered", reason: "Missing", description: "The model gave no answer." }
    : Result.match(outcome, {
        onSuccess: ({ probability }): Outcome => ({ _tag: "Answered", probability }),
        onFailure: ({ description, reason }): Outcome => ({
          _tag: "Unanswered",
          reason,
          // The provider's own wording for a missing answer names the question by its position in the request, which means nothing outside it.
          description: reason === "Missing" ? "The model gave no answer." : description
        })
      })

/** What the provider says a request cost, when it says: a provider reports a cost among the details it returns of its response. */
const costOf = (metadata: Readonly<Record<string, unknown>>): number | undefined => {
  const costs = Array.flatMap(Record.values(metadata), (details) =>
    Predicate.isObject(details) && Predicate.isNumber(details["cost"]) ? [details["cost"]] : []
  )
  return Array.isReadonlyArrayNonEmpty(costs) ? Array.reduce(costs, 0, (total, cost) => total + cost) : undefined
}

/** Asks the model about every entry, and returns each entry's outcome in order with what it cost. Answers the model gave before to the same question about the same evidence are taken from the decision cache rather than asked for again, and new answers are added to it. The rest are asked a limited number per request, and a request that fails leaves its entries unanswered rather than failing the rest, as does one that the run's budget has no room for. */
export const ask = Effect.fnUntraced(function* <A, R>(options: {
  readonly entries: ReadonlyArray<A>
  /** What sets an entry's question apart from the others asked about the same evidence. */
  readonly id: (entry: A) => string
  /** Everything the questions share: how they are put to the model, and the evidence they are about. */
  readonly shared: unknown
  readonly request: (
    questions: Readonly<Record<string, A>>
  ) => Effect.Effect<ProbabilityResponse<string>, AiError.AiError, R>
}) {
  const { recall, remember } = yield* DecisionCache
  const spending = yield* Budget.CurrentSpending
  // What is remembered goes by everything the questions share, so a change to how they are put, or to the evidence, asks again.
  const key = yield* hash(options.shared)
  const remembered = yield* recall(key)
  const unanswered = Array.filter(options.entries, (entry) => !Record.has(remembered, options.id(entry)))
  const answers = yield* Effect.forEach(
    Array.chunksOf(unanswered, questionsPerRequest),
    Effect.fnUntraced(function* (chunk) {
      // Keys are positions, since a provider may not accept every character a trait reference can hold.
      const request = options.request(
        Record.fromEntries(Array.map(chunk, (entry, index) => [`t${index}`, entry] as const))
      )
      const reserved = spending === undefined ? Result.succeed(0) : yield* Budget.reserve(spending, request)
      if (Result.isFailure(reserved)) {
        return {
          outcomes: Array.map(chunk, (): Outcome => ({
            _tag: "Unanswered",
            reason: "OverBudget",
            description: reserved.failure
          })),
          usage: noUsage
        }
      }
      return yield* request.pipe(
        Effect.map((response) => {
          const cost = costOf(response.metadata)
          return {
            outcomes: Array.map(chunk, (_, index) => toOutcome(response.outcomes[`t${index}`])),
            reported: {
              tokens:
                response.usage.inputTokens === undefined
                  ? undefined
                  : response.usage.inputTokens + (response.usage.outputTokens ?? 0),
              cost
            },
            usage: {
              requests: 1,
              inputTokens: response.usage.inputTokens ?? 0,
              outputTokens: response.usage.outputTokens ?? 0,
              ...(cost === undefined ? {} : { cost }),
              remembered: 0
            }
          }
        }),
        Effect.tap(({ reported }) =>
          spending === undefined ? Effect.void : Budget.settle({ spending, reserved: reserved.success, used: reported })
        ),
        Effect.map(({ outcomes, usage }) => ({ outcomes, usage })),
        Effect.catchTag("AiError", (error) =>
          Effect.succeed({
            outcomes: Array.map(chunk, (): Outcome => ({
              _tag: "Unanswered",
              reason: "Failed",
              description: error.message
            })),
            usage: { ...noUsage, requests: 1 }
          })
        )
      )
    }),
    { concurrency: "unbounded" }
  )
  const asked = new Map(
    Array.zipWith(
      unanswered,
      Array.flatMap(answers, ({ outcomes }) => outcomes),
      (entry, outcome) => [options.id(entry), outcome] as const
    )
  )
  const learned = Record.fromEntries(
    Array.flatMap([...asked], ([id, outcome]) =>
      outcome._tag === "Answered" ? [[id, outcome.probability] as const] : []
    )
  )
  if (!Record.isEmptyRecord(learned)) {
    yield* remember(key, { ...remembered, ...learned })
  }
  return {
    outcomes: Array.map(options.entries, (entry): Outcome => {
      const id = options.id(entry)
      const probability = remembered[id]
      return Record.has(remembered, id) && probability !== undefined
        ? { _tag: "Answered", probability }
        : (asked.get(id) ?? { _tag: "Unanswered", reason: "Missing", description: "The model gave no answer." })
    }),
    usage: Array.reduce(
      answers,
      { ...noUsage, remembered: options.entries.length - unanswered.length },
      (total, { usage }) => addUsage(total, usage)
    )
  }
})
