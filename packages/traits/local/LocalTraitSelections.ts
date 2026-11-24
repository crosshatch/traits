import { Array, Effect, FileSystem, Layer, Option, Record } from "effect"

import * as TraitSelections from "../TraitSelection/TraitSelections.ts"
import { LocalPaths } from "./LocalPaths.ts"
import * as TraitsConfig from "./TraitsConfig/TraitsConfig.ts"

/** Takes the selections from selections in traits/config.json, an object of each selection's trait references by the selection's ID. The file is read on each use, so an edit to it takes effect at once. */
export const layer = Effect.gen(function* () {
  const services = yield* Effect.context<FileSystem.FileSystem | LocalPaths>()

  const selections = TraitsConfig.load.pipe(
    Effect.map((config) => config.selections),
    Effect.provide(services)
  )

  return TraitSelections.TraitSelections.of({
    ls: selections.pipe(
      Effect.map((declared) =>
        Array.map(Record.toEntries(declared), ([id, traits]) => TraitSelections.TraitSelection.make({ id, traits }))
      ),
      Effect.withSpan("LocalTraitSelections.ls")
    ),
    get: Effect.fn("LocalTraitSelections.get")(function* (id) {
      const declared = yield* selections
      // Looked up as its own entry, since an ID such as constructor names something every object inherits.
      const traits = Record.get(declared, id)
      if (Option.isNone(traits)) {
        return yield* TraitSelections.TraitSelectionNotFoundError.make({ traitSelectionId: id })
      }
      return TraitSelections.TraitSelection.make({ id, traits: traits.value })
    })
  })
}).pipe(Layer.effect(TraitSelections.TraitSelections))
