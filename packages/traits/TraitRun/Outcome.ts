import { Schema as S } from "effect"

import { Probability } from "../util/Probability.ts"

/** What the model said about one question: how likely it is, or why there is no answer. */
export type Outcome = typeof Outcome.Type
export const Outcome = S.TaggedUnion({
  /** The model gave a probability. */
  Answered: {
    /** How likely it is, from 0 to 1. */
    probability: Probability
  },
  /** There is no probability to go on. */
  Unanswered: {
    /** Why: the model left it out, refused, gave no usable distribution, or gave an invalid answer, the request itself failed, or it was not asked because the run had reached its budget. */
    reason: S.Literals(["Missing", "Refused", "NoDistribution", "Invalid", "Failed", "OverBudget"]).annotateKey({
      description:
        "Why: the model left it out, refused, gave no usable distribution, or gave an invalid answer, the request itself failed, or it was not asked because the run had reached its budget."
    }),
    /** What the model or the failed request reported. */
    description: S.String.annotateKey({ description: "What the model or the failed request reported." })
  }
}).annotate({ description: "What the model said about one question: how likely it is, or why there is no answer." })
