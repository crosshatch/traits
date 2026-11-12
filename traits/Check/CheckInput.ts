import { Array, Schema as S } from "effect"

import { TraitOrigin } from "../Report/TraitOrigin.ts"
import { Trait } from "../Trait.ts"
import { Change } from "../util/util.ts"

/** A static trait to evaluate, with where the host loaded it from. */
export type CheckTrait = typeof CheckTrait.Type
export const CheckTrait = S.Struct({
  /** The static trait definition, with canonical extension references. */
  trait: Trait.annotateKey({ description: "The static trait definition, with canonical extension references." }),
  /** Where the host loaded the trait definition from; omitted when unknown. */
  origin: TraitOrigin.annotateKey({
    description: "Where the host loaded the trait definition from; omitted when unknown."
  }).pipe(S.optionalKey)
}).annotate({ description: "A static trait to evaluate, with where the host loaded it from." })

/** A text change to evaluate against every supplied trait. */
export type CheckChange = typeof CheckChange.Type
export const CheckChange = S.Struct({
  /** The supplied before and/or after text snapshots. */
  change: Change.annotateKey({ description: "The supplied before and/or after text snapshots." })
}).annotate({ description: "A text change to evaluate against every supplied trait." })

/** Caller-ordered, uniquely named traits and text changes with distinct after paths. */
export type CheckInput = typeof CheckInput.Type
export const CheckInput = S.Struct({
  /** Traits in report order, with unique names. */
  traits: S.Array(CheckTrait).annotate({ description: "Traits in report order, with unique names." }),
  /** Changes in caller order with distinct after paths; report change positions follow this order. */
  changes: S.Array(CheckChange).annotate({
    description: "Changes in caller order with distinct after paths; report change positions follow this order."
  })
})
  .annotate({ description: "Caller-ordered, uniquely named traits and text changes with distinct after paths." })
  .check(
    S.makeFilter(
      (input) => {
        const names = Array.map(input.traits, (entry) => entry.trait.name)
        return Array.dedupe(names).length === names.length
      },
      { message: "Trait names must be unique." }
    ),
    S.makeFilter(
      (input) => {
        const afterPaths = Array.flatMap(input.changes, (entry) =>
          entry.change.after === undefined ? [] : [entry.change.after.path]
        )
        return Array.dedupe(afterPaths).length === afterPaths.length
      },
      { message: "No two changes may share an after path." }
    )
  )
