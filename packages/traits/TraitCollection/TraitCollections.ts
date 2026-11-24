import { Context, type Effect, Schema as S } from "effect"

import type { StorageError } from "../StorageError.ts"
import type { TraitCollection } from "./TraitCollection.ts"
import type { TraitCollectionChanges } from "./TraitCollectionChanges.ts"
import type { TraitSource } from "./TraitSource.ts"
import { TraitSourceId } from "./TraitSourceId.ts"

export * from "./TraitSource.ts"
export * from "./TraitSourceId.ts"
export * from "./TraitCollectionChanges.ts"

/** The workspace declares no trait source with the requested ID. */
export class TraitCollectionNotFoundError extends S.TaggedError<TraitCollectionNotFoundError>()(
  "TraitCollectionNotFoundError",
  {
    /** The ID that no declared trait source has. */
    traitSourceId: TraitSourceId.annotateKey({ description: "The ID that no declared trait source has." })
  }
) {
  override get message() {
    return `There is no trait source with the ID ${this.traitSourceId}.`
  }
}

/** A trait collection could not be brought up to date with its source; the collection is left as it was. */
export class TraitCollectionUpdateError extends S.TaggedError<TraitCollectionUpdateError>()(
  "TraitCollectionUpdateError",
  {
    /** The ID of the source the collection could not be updated from. */
    traitSourceId: TraitSourceId.annotateKey({
      description: "The ID of the source the collection could not be updated from."
    }),
    /** What went wrong, such as the source being unreachable or holding a file that is not a valid trait. */
    problem: S.String.annotateKey({
      description: "What went wrong, such as the source being unreachable or holding a file that is not a valid trait."
    }),
    /** The underlying failure, when there is one. */
    cause: S.Defect().annotateKey({ description: "The underlying failure, when there is one." }).pipe(S.optionalKey)
  }
) {
  override get message() {
    return `Could not update the trait collection ${this.traitSourceId}: ${this.problem}`
  }
}

/** The workspace's trait collections, by the ID of the source each comes from. The collections are fixed: none can be added or removed here, and their traits cannot be changed, only updated from their source. Hosts supply where they are stored. */
export class TraitCollections extends Context.Service<
  TraitCollections,
  {
    /** Every declared trait source, by its ID. */
    readonly sources: Effect.Effect<Readonly<Record<TraitSourceId, TraitSource>>, StorageError>
    /** The collection of traits from the source with this ID, as it was last updated. */
    readonly get: (id: TraitSourceId) => Effect.Effect<TraitCollection, TraitCollectionNotFoundError | StorageError>
    /** Brings the collection up to date with its source, such as the latest commit of its branch, and returns what changed. */
    readonly update: (
      id: TraitSourceId
    ) => Effect.Effect<TraitCollectionChanges, TraitCollectionNotFoundError | TraitCollectionUpdateError | StorageError>
    /** Updates every collection, one source at a time, and returns what changed in each. It stops at the first source that fails, leaving the sources before it updated. */
    readonly updateAll: Effect.Effect<
      Readonly<Record<TraitSourceId, TraitCollectionChanges>>,
      TraitCollectionUpdateError | StorageError
    >
  }
>()("traits/TraitCollection/TraitCollections") {}
