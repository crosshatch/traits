import { Context, type Effect, Schema as S } from "effect"

import type { StorageError } from "../StorageError.ts"
import type { TraitSelection } from "./TraitSelection.ts"
import { TraitSelectionId } from "./TraitSelectionId.ts"

export * from "./TraitReference.ts"
export * from "./TraitSelection.ts"
export * from "./TraitSelectionId.ts"

/** No selection has the requested ID. */
export class TraitSelectionNotFoundError extends S.TaggedError<TraitSelectionNotFoundError>()(
  "TraitSelectionNotFoundError",
  {
    /** The ID that no selection has. */
    traitSelectionId: TraitSelectionId.annotateKey({ description: "The ID that no selection has." })
  }
) {
  override get message() {
    return `There is no selection with the ID ${this.traitSelectionId}.`
  }
}

/** The workspace's selections of traits, by ID. They are declared, so none can be added, changed, or removed here. Hosts supply where they are declared. */
export class TraitSelections extends Context.Service<
  TraitSelections,
  {
    /** Every selection, in the order they are declared. */
    readonly ls: Effect.Effect<ReadonlyArray<TraitSelection>, StorageError>
    /** The selection with this ID. */
    readonly get: (id: TraitSelectionId) => Effect.Effect<TraitSelection, TraitSelectionNotFoundError | StorageError>
  }
>()("traits/TraitSelection/TraitSelections") {}
