import { Array, Effect, pipe } from "effect"

import type { Trait } from "../Trait/Trait.ts"
import { TraitCollections } from "../TraitCollection/TraitCollections.ts"
import { WorkspaceTraitCollection } from "../TraitCollection/WorkspaceTraitCollection.ts"
import type { TraitReference } from "./TraitReference.ts"
import { defaultTraitSelectionId, type TraitSelectionId } from "./TraitSelectionId.ts"
import { TraitSelections } from "./TraitSelections.ts"

/** A trait, with the reference a selection chose it by. */
export interface ResolvedTrait {
  readonly reference: TraitReference
  readonly trait: Trait
}

/** The traits the selections refer to, each once, in the order they are first referred to. When no selection is named, they are those of the selection with the ID default, and there being none fails like any other missing selection. */
export const fromSelections = Effect.fn("ResolvedTrait.fromSelections")(function* (
  named: ReadonlyArray<TraitSelectionId>
) {
  const own = yield* WorkspaceTraitCollection
  const selections = yield* TraitSelections
  const collections = yield* TraitCollections
  const ids = Array.isReadonlyArrayNonEmpty(named) ? named : [defaultTraitSelectionId]
  const chosen = yield* Effect.forEach(ids, (id) => selections.get(id), { concurrency: 1 })
  const references = pipe(
    chosen,
    Array.flatMap(({ traits }) => traits),
    Array.dedupeWith((a, b) => a.source === b.source && a.name === b.name)
  )
  const sources = pipe(
    references,
    Array.flatMap(({ source }) => (source === undefined ? [] : [source])),
    Array.dedupe
  )
  const sourced = yield* Effect.forEach(
    sources,
    (id) => collections.get(id).pipe(Effect.map((collection) => [id, collection] as const)),
    { concurrency: 1 }
  )
  const bySource = new Map(sourced)
  return yield* Effect.forEach(
    references,
    Effect.fnUntraced(function* (reference) {
      const collection = reference.source === undefined ? own : bySource.get(reference.source)
      if (collection === undefined) {
        // Every source a reference names was looked up just above.
        return yield* Effect.die(new Error(`No collection was looked up for the source ${reference.source}.`))
      }
      const trait = yield* collection.get(reference.name)
      return { reference, trait } satisfies ResolvedTrait
    }),
    { concurrency: 1 }
  )
})
