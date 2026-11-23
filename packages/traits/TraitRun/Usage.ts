import { Function, Schema as S } from "effect"

/** What the model was asked and what that used, and the answers that needed nothing. */
export type Usage = typeof Usage.Type
export const Usage = S.Struct({
  /** Requests made of the model. */
  requests: S.Int.annotateKey({ description: "Requests made of the model." }),
  /** Tokens sent to the model. */
  inputTokens: S.Finite.annotateKey({ description: "Tokens sent to the model." }),
  /** Tokens the model produced. */
  outputTokens: S.Finite.annotateKey({ description: "Tokens the model produced." }),
  /** What the provider reported the requests to have cost, in US dollars; omitted when it reported no cost. */
  cost: S.Finite.annotateKey({
    description:
      "What the provider reported the requests to have cost, in US dollars; omitted when it reported no cost."
  }).pipe(S.optionalKey),
  /** Answers taken from earlier runs instead of asking the model again, which used no tokens. */
  remembered: S.Int.annotateKey({
    description: "Answers taken from earlier runs instead of asking the model again, which used no tokens."
  })
}).annotate({ description: "What the model was asked and what that used, and the answers that needed nothing." })

/** The usage of a run that asked nothing and remembered nothing. */
export const noUsage: Usage = { requests: 0, inputTokens: 0, outputTokens: 0, remembered: 0 }

/** The usage of two parts of a run together. */
export const addUsage: {
  (b: Usage): (a: Usage) => Usage
  (a: Usage, b: Usage): Usage
} = Function.dual(2, (a: Usage, b: Usage): Usage => ({
  requests: a.requests + b.requests,
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  ...(a.cost === undefined && b.cost === undefined ? {} : { cost: (a.cost ?? 0) + (b.cost ?? 0) }),
  remembered: a.remembered + b.remembered
}))
