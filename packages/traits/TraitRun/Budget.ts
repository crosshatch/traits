import { Context, Effect, Function, Ref, Schema as S } from "effect"

/** The cost, in US dollars, after which a run asks nothing more, which takes a provider, and an agent for preludes, that report what they cost. Requests already under way when it is reached are finished, so a run may cost somewhat more. */
export interface Budget {
  readonly dollars: number
}

/** What a run has cost so far, as its providers' responses report it. */
interface Spent {
  readonly cost: number
  /** Whether the provider answered a request, or the agent carried out a task, without reporting its cost, after which the budget cannot be kept. */
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
    ? `It was not asked: what the run had done reported no cost for the $${max} to stop after to go by.`
    : cost >= max
      ? `It was not asked: the run had cost $${cost} by then, which reached the $${max} it was to stop after.`
      : undefined

/** Something was not done because the run had reached its budget. */
export class OverBudget extends S.TaggedError<OverBudget>()("OverBudget", {
  /** Why nothing more is done. */
  reason: S.String.annotateKey({ description: "Why nothing more is done." })
}) {
  override get message() {
    return this.reason
  }
}

/** Does something that costs, such as a request of the model or a task of the agent that carries out preludes, unless the run has reached its budget, in which case it fails with why. A run with no budget does everything. What it is said to have cost is then added to what the run has cost, and something said to cost nothing that can be told leaves the budget unable to be kept. */
export const within: {
  <A>(
    costOf: (done: A) => number | undefined
  ): <E, R>(costly: Effect.Effect<A, E, R>) => Effect.Effect<A, E | OverBudget, R>
  <A, E, R>(
    costly: Effect.Effect<A, E, R>,
    costOf: (done: A) => number | undefined
  ): Effect.Effect<A, E | OverBudget, R>
} = Function.dual(2, <A, E, R>(costly: Effect.Effect<A, E, R>, costOf: (done: A) => number | undefined) =>
  Effect.gen(function* () {
    const spending = yield* CurrentSpending
    if (spending === undefined) {
      return yield* costly
    }
    const spent = yield* Ref.get(spending.spent)
    const reason = stopped(spending, spent)
    if (reason !== undefined) {
      return yield* OverBudget.make({ reason })
    }
    const done = yield* costly
    const cost = costOf(done)
    yield* Ref.update(spending.spent, (spent) =>
      cost === undefined ? { ...spent, unpriced: true } : { ...spent, cost: spent.cost + cost }
    )
    return done
  })
)
