import { Array, Function, Predicate, Record, Schema as S } from "effect"

import type { ProbabilityResponse } from "./ProbabilityResponse.ts"

/** What the model was asked and what that used, and the answers that needed nothing. */
export type Usage = typeof Usage.Type
export const Usage = S.Struct({
  /** Requests made of the model. */
  requests: S.Int.annotateKey({ description: "Requests made of the model." }),
  /** Tokens sent to the model. */
  inputTokens: S.Finite.annotateKey({ description: "Tokens sent to the model." }),
  /** Tokens the model produced. */
  outputTokens: S.Finite.annotateKey({ description: "Tokens the model produced." }),
  /** What the provider reported the requests to have cost, and the agent its prelude tasks, in US dollars; omitted when neither reported a cost. */
  cost: S.Finite.annotateKey({
    description:
      "What the provider reported the requests to have cost, and the agent its prelude tasks, in US dollars; omitted when neither reported a cost."
  }).pipe(S.optionalKey),
  /** Tasks that the agent that carries out traits' preludes carried out. */
  preludeTasks: S.Int.annotateKey({
    description: "Tasks that the agent that carries out traits' preludes carried out."
  }),
  /** Answers taken from earlier runs instead of asking the model again, which used no tokens. */
  remembered: S.Int.annotateKey({
    description: "Answers taken from earlier runs instead of asking the model again, which used no tokens."
  })
}).annotate({ description: "What the model was asked and what that used, and the answers that needed nothing." })

/** The usage of a run that asked nothing and remembered nothing. */
export const noUsage: Usage = { requests: 0, inputTokens: 0, outputTokens: 0, preludeTasks: 0, remembered: 0 }

/** The usage of two parts of a run together. */
export const addUsage: {
  (b: Usage): (a: Usage) => Usage
  (a: Usage, b: Usage): Usage
} = Function.dual(2, (a: Usage, b: Usage): Usage => ({
  requests: a.requests + b.requests,
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  ...(a.cost === undefined && b.cost === undefined ? {} : { cost: (a.cost ?? 0) + (b.cost ?? 0) }),
  preludeTasks: a.preludeTasks + b.preludeTasks,
  remembered: a.remembered + b.remembered
}))

/** What the provider says a request cost, when it says: a provider reports a cost among the details it returns of its response. */
const costOf = (metadata: Readonly<Record<string, unknown>>): number | undefined => {
  const costs = Array.flatMap(Record.values(metadata), (details) =>
    Predicate.isObject(details) && Predicate.isNumber(details["cost"]) ? [details["cost"]] : []
  )
  return Array.isReadonlyArrayNonEmpty(costs) ? Array.reduce(costs, 0, (total, cost) => total + cost) : undefined
}

/** What one request used, as its response reports it. */
export const fromResponse = (response: ProbabilityResponse): Usage => {
  const cost = costOf(response.metadata)
  return {
    requests: 1,
    inputTokens: response.usage.inputTokens ?? 0,
    outputTokens: response.usage.outputTokens ?? 0,
    ...(cost === undefined ? {} : { cost }),
    preludeTasks: 0,
    remembered: 0
  }
}
