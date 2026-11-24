import { Schema as S } from "effect"

import { TraitReference } from "./TraitReference.ts"
import { TraitSelectionId } from "./TraitSelectionId.ts"

/** A selection of traits under an ID, as references to them, such as a smaller set to check in CI. */
export type TraitSelection = typeof TraitSelection.Type
export const TraitSelection = S.Struct({
  /** The kebab-case ID of a selection of traits, starting with a letter, such as ci. */
  id: TraitSelectionId,
  /** References to the traits in the selection. */
  traits: S.Array(TraitReference).annotateKey({
    description: "References to the traits in the selection."
  })
}).annotate({
  description: "A selection of traits under an ID, as references to them, such as a smaller set to check in CI."
})
