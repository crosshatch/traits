import { Context, Effect, Ref, Result } from "effect"
import type { AiError } from "effect/ai"

import type { ProbabilityResponse } from "./ProbabilityResponse.ts"
import { fromResponse } from "./Usage.ts"

/** The cost, in US dollars, after which a run asks nothing more, which takes a provider that reports what its requests cost. Requests already under way when it is reached are finished, so a run may cost somewhat more. */
export interface Budget {
  readonly dollars: number
}

/** What a run has cost so far, as its providers' responses report it. */
interface Spent {
  readonly cost: number
  /** Whether the provider answered a request without reporting its cost, after which the budget cannot be kept. */
  readonly unpriced: boolean
}

/** A run's budget, and what has become of it so far. */
interface Spending {
  readonly max: number
  readonly spent: Ref.Ref<Spent>
}

/** A budget with nothing yet spent of it. */
export const spendingOf = Effect.fnUntraced(function* (budget: Budget) {
  const spent = yield* Ref.make<Spent>({ cost: 0, unpriced: false })
  return { max: budget.dollars, spent } satisfies Spending
})

/** The budget the questions of a run are asked within, and what has become of it; none when the run has no budget. */
export const CurrentSpending = Context.Reference<Spending | undefined>("traits/TraitRun/Budget/CurrentSpending", {
  defaultValue: () => undefined
})

/** Why nothing more is to be asked, when that is so. */
const stopped = ({ max }: Spending, { cost, unpriced }: Spent) =>
  unpriced
    ? `It was not asked: the provider reports no cost for the $${max} to stop after to go by.`
    : cost >= max
      ? `It was not asked: the run had cost $${cost} by then, which reached the $${max} it was to stop after.`
      : undefined

/** Makes a request unless the run has reached its budget, and returns its response, or why it was not made. A run with no budget makes every request. What the provider says the request cost is then added to what the run has cost. */
export const within = <R>(
  request: Effect.Effect<ProbabilityResponse, AiError.AiError, R>
): Effect.Effect<Result.Result<ProbabilityResponse, string>, AiError.AiError, R> =>
  Effect.gen(function* () {
    const spending = yield* CurrentSpending
    if (spending === undefined) {
      return yield* Effect.map(request, (response) => Result.succeed(response))
    }
    const reason = stopped(spending, yield* Ref.get(spending.spent))
    if (reason !== undefined) {
      return Result.fail(reason)
    }
    const response = yield* request
    const { cost } = fromResponse(response)
    yield* Ref.update(spending.spent, (spent) =>
      cost === undefined ? { ...spent, unpriced: true } : { ...spent, cost: spent.cost + cost }
    )
    return Result.succeed(response)
  })
