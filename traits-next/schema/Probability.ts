import { Schema as S } from "effect"

export type Probability = typeof Probability.Type
/** A finite probability between zero and one, inclusive. */
export const Probability = S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 }))
