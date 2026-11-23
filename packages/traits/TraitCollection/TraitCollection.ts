import { type Effect, Schema as S } from "effect"

import type { StorageError } from "../StorageError.ts"
import type { Trait } from "../Trait/Trait.ts"
import { TraitName } from "../Trait/TraitName.ts"

/** A collection of traits, by name, such as the traits of one source. Its traits cannot be changed through it. Hosts supply where they are stored. */
export interface TraitCollection {
  /** The names of every trait in the collection. */
  readonly names: Effect.Effect<ReadonlyArray<TraitName>, StorageError>
  /** The trait with this name. */
  readonly get: (name: TraitName) => Effect.Effect<Trait, TraitNotFoundError | StorageError>
}

/** No trait in the collection has the requested name. */
export class TraitNotFoundError extends S.TaggedError<TraitNotFoundError>()("TraitNotFoundError", {
  /** The name that no trait in the collection has. */
  traitName: TraitName.annotateKey({ description: "The name that no trait in the collection has." })
}) {
  override get message() {
    return `There is no trait named ${this.traitName}.`
  }
}
