import { Schema as S } from "effect"

import { Probability } from "./util/Probability.ts"

/** Subject-membership probabilities; normalization is owned by the decision model, and checks apply the rule-out threshold. */
export type TraitSubjectMatch = typeof TraitSubjectMatch.Type
export const TraitSubjectMatch = S.Struct({
  /** Probability that the selected target is or contains an instance of the subject. */
  yes: Probability.annotateKey({
    description: "Probability that the selected target is or contains an instance of the subject."
  }),
  /** Probability that no part of the selected target is an instance of the subject. */
  no: Probability.annotateKey({
    description: "Probability that no part of the selected target is an instance of the subject."
  }),
  /** Probability that available evidence cannot establish subject membership. */
  uncertain: Probability.annotateKey({
    description: "Probability that available evidence cannot establish subject membership."
  })
}).annotate({
  description:
    "Subject-membership probabilities; normalization is owned by the decision model, and checks apply the rule-out threshold."
})
