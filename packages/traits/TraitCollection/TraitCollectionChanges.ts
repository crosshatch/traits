import { Schema as S } from "effect"

import { TraitName } from "../Trait/TraitName.ts"

/** What an update changed in a collection's traits, by name. */
export type TraitCollectionChanges = typeof TraitCollectionChanges.Type
export const TraitCollectionChanges = S.Struct({
  /** The traits the source has that the collection did not. */
  added: S.Array(TraitName).annotateKey({ description: "The traits the source has that the collection did not." }),
  /** The traits whose files differ in the source. */
  changed: S.Array(TraitName).annotateKey({ description: "The traits whose files differ in the source." }),
  /** The traits the collection had that the source no longer has. */
  removed: S.Array(TraitName).annotateKey({
    description: "The traits the collection had that the source no longer has."
  })
}).annotate({ description: "What an update changed in a collection's traits, by name." })
