import { Schema as S } from "effect"

import { TraitName } from "./TraitName.ts"

/** A named selection of the workspace's traits to check, such as a smaller set for CI. */
export type TraitsEnvironment = typeof TraitsEnvironment.Type
export const TraitsEnvironment = S.Struct({
  /** Distinct trait names to assess; an empty list selects no traits. */
  traits: S.Array(TraitName).check(S.isUnique()).annotateKey({
    description: "Distinct trait names to assess; an empty list selects no traits."
  })
}).annotate({
  description: "A named selection of the workspace's traits to check, such as a smaller set for CI."
})
