import { Schema as S } from "effect"

/** A probability, from 0 to 1. */
export type Probability = typeof Probability.Type
export const Probability = S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 }))
  .pipe(S.brand("traits/Probability"))
  .annotate({
    description: "A probability, from 0 to 1."
  })
