import { Array, Effect, Order, Record, Result } from "effect"
import { type Decision, DecisionModel } from "effect/ai"

import { CurrentSettings } from "../Settings.ts"

type Response<Key extends string, Label extends string> = DecisionModel.DecideSettledResponse<
  Record<Key, Decision.Classify<Label>>
>

/** A token count summed over responses, or unreported when any response did not report it. */
const total = (
  responses: ReadonlyArray<{ readonly usage: DecisionModel.DecisionUsage }>,
  count: "inputTokens" | "outputTokens"
) =>
  Array.every(responses, (response) => response.usage[count] !== undefined)
    ? Array.reduce(responses, 0, (sum, response) => sum + response.usage[count]!)
    : undefined

/**
 * Settles a close call: when the answer's deciding probability is within check.resampling.margin of its threshold,
 * asks again until it has check.resampling.samples answers, and again until closeSamples when their average is still
 * within closeMargin. Answers vary between identical requests, so one answer near a threshold decides a verdict at
 * random; their average does not. The response carries the averaged probabilities, their most likely label, and the
 * usage of every request. Further requests that fail or go unanswered are left out of the average.
 */
export const settle = Effect.fnUntraced(function* <Key extends string, Label extends string, E, R>(
  key: Key,
  ask: Effect.Effect<Response<Key, Label>, E, R>,
  /** How far the answer's probabilities are from the threshold that decides its verdict. */
  distance: (probabilities: { readonly [L in Label]: number }) => number
) {
  const {
    check: { resampling }
  } = yield* CurrentSettings
  const first = yield* ask
  const outcome = first.outcomes[key]
  if (Result.isFailure(outcome)) {
    return first
  }
  const answered = [{ probabilities: outcome.success.probabilities }]
  // Unanswered requests still used tokens.
  const responses = [first]
  const average = () =>
    Record.map(
      outcome.success.probabilities,
      (_, label: Label) =>
        Array.reduce(answered, 0, (sum, answer) => sum + answer.probabilities[label]) / answered.length
    )
  let wanted = distance(outcome.success.probabilities) < resampling.margin ? resampling.samples : 1
  // Attempts are counted rather than answers, so a provider that keeps failing cannot hold the check.
  for (let attempts = 1; attempts < wanted; attempts++) {
    const next = yield* Effect.option(ask)
    if (next._tag === "Some") {
      responses.push(next.value)
      const answer = next.value.outcomes[key]
      if (Result.isSuccess(answer)) {
        answered.push({ probabilities: answer.success.probabilities })
      }
    }
    if (attempts + 1 === wanted && wanted < resampling.closeSamples && distance(average()) < resampling.closeMargin) {
      wanted = resampling.closeSamples
    }
  }
  if (responses.length === 1) {
    return first
  }
  const probabilities = average()
  const [label] = Array.sort(
    Record.keys(probabilities),
    Order.mapInput(Order.flip(Order.Number), (label: Label) => probabilities[label])
  )
  return {
    ...first,
    outcomes: Record.set(first.outcomes, key, Result.succeed({ label: label!, probabilities })),
    usage: DecisionModel.DecisionUsage.make({
      inputTokens: total(responses, "inputTokens"),
      outputTokens: total(responses, "outputTokens")
    })
  }
})
