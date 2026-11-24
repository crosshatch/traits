import { Context, type Effect, Schema as S } from "effect"

import type { StorageError } from "../StorageError.ts"
import type { Trait } from "../Trait/Trait.ts"
import { TraitName } from "../Trait/TraitName.ts"
import type { TraitCollection, TraitNotFoundError } from "./TraitCollection.ts"

/** One of the workspace's own traits already has the name another was to be given. */
export class TraitAlreadyExistsError extends S.TaggedError<TraitAlreadyExistsError>()("TraitAlreadyExistsError", {
  /** The name one of the workspace's own traits already has. */
  traitName: TraitName.annotateKey({ description: "The name one of the workspace's own traits already has." })
}) {
  override get message() {
    return `There is already a trait named ${this.traitName}.`
  }
}

/** The workspace's own traits, which selections refer to by name alone. Unlike the collections that come from declared sources, they can be added, changed, renamed, and deleted here. Hosts supply where they are stored. */
export class WorkspaceTraitCollection extends Context.Service<
  WorkspaceTraitCollection,
  TraitCollection & {
    /** Adds the trait, or replaces the one that has its name. */
    readonly write: (trait: Trait) => Effect.Effect<void, StorageError>
    /** Replaces an existing trait with the result of applying the function to it, and returns the new trait. The trait keeps this name, whatever name the result carries; use rename to change it. */
    readonly update: (
      name: TraitName,
      f: (trait: Trait) => Trait
    ) => Effect.Effect<Trait, TraitNotFoundError | StorageError>
    /** Gives an existing trait a new name, and returns the renamed trait. Fails rather than replace a trait that already has the new name. */
    readonly rename: (
      from: TraitName,
      to: TraitName
    ) => Effect.Effect<Trait, TraitNotFoundError | TraitAlreadyExistsError | StorageError>
    /** Deletes the trait with this name. */
    readonly delete: (name: TraitName) => Effect.Effect<void, TraitNotFoundError | StorageError>
  }
>()("traits/TraitCollection/WorkspaceTraitCollection") {}
