import { Context, Effect, Ref, Result } from "effect"
import { type AiError, DecisionModel } from "effect/ai"

import * as PlanningModel from "./PlanningModel.ts"
import type { ProbabilityResponse } from "./ProbabilityResponse.ts"

/** The most a run may use: a number of tokens, or an amount in US dollars, which takes a provider that reports what its requests cost. */
export type Budget = { readonly tokens: number } | { readonly dollars: number }

/** What has become of a run's budget so far. */
interface Spent {
  /** How much of the budget is spoken for, in its unit: what finished requests used, and what is set aside for requests still under way. */
  readonly committed: number
  /** The tokens and the cost of the requests the provider has reported a cost for, which is what a token is taken to cost. */
  readonly tokens: number
  readonly cost: number
  /** Whether the provider answered a request without reporting its cost, after which a budget in dollars cannot be kept. */
  readonly unpriced: boolean
}

/** A run's budget, and what has become of it so far. */
interface Spending {
  readonly unit: "tokens" | "dollars"
  readonly max: number
  readonly state: Ref.Ref<Spent>
}

/** A budget with nothing yet spent of it. */
export const spendingOf = Effect.fnUntraced(function* (budget: Budget) {
  const state = yield* Ref.make<Spent>({ committed: 0, tokens: 0, cost: 0, unpriced: false })
  return (
    "tokens" in budget ? { unit: "tokens", max: budget.tokens, state } : { unit: "dollars", max: budget.dollars, state }
  ) satisfies Spending
})

/** The budget the questions of a run are asked within, and what has become of it; none when the run has no budget. */
export const CurrentSpending = Context.Reference<Spending | undefined>("traits/TraitRun/Budget/CurrentSpending", {
  defaultValue: () => undefined
})

/** Sets aside, from what is left of the budget, what a request is expected to use, and returns how much; or why the request is not to be made. */
export const reserve = Effect.fnUntraced(function* <R>(
  spending: Spending,
  request: Effect.Effect<ProbabilityResponse, AiError.AiError, R>
) {
  const model = yield* PlanningModel.make(0)
  const tokens = yield* request.pipe(
    Effect.provideService(DecisionModel.DecisionModel, model),
    Effect.map(({ usage }) => usage.inputTokens ?? 0),
    // A request that cannot be built fails the same way when it is really made, and uses nothing.
    Effect.orElseSucceed(() => 0)
  )
  const within = spending.unit === "tokens" ? `the budget of ${spending.max} tokens` : `the budget of $${spending.max}`
  return yield* Ref.modify(spending.state, (state): readonly [Result.Result<number, string>, Spent] => {
    if (spending.unit === "dollars" && state.unpriced) {
      return [Result.fail(`It was not asked: the provider reports no cost for ${within} to be kept by.`), state]
    }
    // What a token costs is learned from the requests answered so far, so until one has been, nothing can be set aside for a budget in dollars.
    const expected = spending.unit === "tokens" ? tokens : state.tokens === 0 ? 0 : tokens * (state.cost / state.tokens)
    return state.committed + expected > spending.max
      ? [Result.fail(`It was not asked, to stay within ${within}.`), state]
      : [Result.succeed(expected), { ...state, committed: state.committed + expected }]
  })
})

/** Replaces what was set aside for a request with what the provider says it used. A provider that does not say leaves what was set aside as spent, as does a request that fails. */
export const settle = (options: {
  readonly spending: Spending
  /** What was set aside for the request. */
  readonly reserved: number
  /** What the provider says the request used; undefined for what it does not say. */
  readonly used: { readonly tokens: number | undefined; readonly cost: number | undefined }
}) => {
  const { reserved, spending, used } = options
  return Ref.update(spending.state, (state) => {
    if (spending.unit === "tokens") {
      return used.tokens === undefined ? state : { ...state, committed: state.committed - reserved + used.tokens }
    }
    return used.cost === undefined
      ? { ...state, unpriced: true }
      : {
          ...state,
          committed: state.committed - reserved + used.cost,
          tokens: state.tokens + (used.tokens ?? 0),
          cost: state.cost + used.cost
        }
  })
}
