import { Schema as S } from "effect"

import { Trait } from "../Trait.ts"
import { TraitOrigin } from "../TraitOrigin.ts"
import { Change } from "../util/Change.ts"
import { checkIdentityConstraints } from "./checkIdentityConstraints.ts"

/** A static trait to evaluate, with where the host loaded it from. */
export type CheckTrait = typeof CheckTrait.Type
export const CheckTrait = S.Struct({
  /** The static trait definition, with canonical extension references. */
  trait: Trait.annotateKey({ description: "The static trait definition, with canonical extension references." }),
  /** Where the host loaded the trait definition from. */
  origin: TraitOrigin.annotateKey({ description: "Where the host loaded the trait definition from." })
}).annotate({ description: "A static trait to evaluate, with where the host loaded it from." })

/** Caller-ordered, uniquely named traits and text changes with distinct after paths. */
export type CheckInput = typeof CheckInput.Type
export const CheckInput = S.Struct({
  /** Traits in report order, with unique names. */
  traits: S.Array(CheckTrait).annotate({ description: "Traits in report order, with unique names." }),
  /** Changes in caller order with distinct after paths; report change positions follow this order. */
  changes: S.Array(Change).annotate({
    description: "Changes in caller order with distinct after paths; report change positions follow this order."
  })
})
  .annotate({ description: "Caller-ordered, uniquely named traits and text changes with distinct after paths." })
  .check(...checkIdentityConstraints)
