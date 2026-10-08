import {
  Array,
  Context,
  Crypto,
  Effect,
  FileSystem,
  flow,
  Layer,
  Path,
  pipe,
  PlatformError,
  Schema as S,
  String
} from "effect"

import { words } from "./_util/words.ts"
import { Trait, TraitId } from "./Trait.ts"

export const TraitStoreError = S.TaggedStruct("PlatformError", { message: S.String })

export class TraitStore extends Context.Service<
  TraitStore,
  {
    readonly add: (body: string) => Effect.Effect<Trait, PlatformError.PlatformError>
    readonly update: (trait: Trait) => Effect.Effect<void, PlatformError.PlatformError>
    readonly get: (traitId: TraitId) => Effect.Effect<Trait, PlatformError.PlatformError>
    readonly ls: Effect.Effect<ReadonlyArray<Trait>, PlatformError.PlatformError>
    readonly rm: (traitIds: ReadonlyArray<TraitId>) => Effect.Effect<void, PlatformError.PlatformError>
  }
>()("traits/TraitStore") {}

export const layerFileSystem = (dir: string) =>
  Layer.effect(
    TraitStore,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const crypto = yield* Crypto.Crypto
      const root = path.resolve(dir)
      yield* fs.makeDirectory(root, { recursive: true })

      const traitPath = (traitId: TraitId) => path.join(root, `${traitId}.md`)

      return TraitStore.of({
        add: Effect.fn("TraitStore.add")(function* (body) {
          const indices: Array<number> = []
          while (indices.length < 3) {
            const index = yield* crypto.randomIntBetween(0, words.length, { halfOpen: true })
            if (!Array.contains(indices, index)) indices.push(index)
          }
          const prefix = pipe(
            indices,
            Array.map((index) => Array.getUnsafe(words, index)),
            Array.join("_")
          )
          const uuid = yield* crypto.randomUUIDv4
          const trait = Trait.make({ id: TraitId.make(`${prefix}-${uuid}`), body })
          yield* fs.writeFileString(traitPath(trait.id), trait.body, { flag: "wx" })
          return trait
        }),
        get: (traitId) =>
          fs.readFileString(traitPath(traitId)).pipe(Effect.map((body) => Trait.make({ id: traitId, body }))),
        update: Effect.fn("TraitStore.update")(function* (trait) {
          const file = yield* fs.open(traitPath(trait.id), { flag: "r+" })
          yield* file.truncate(0)
          yield* file.writeAll(new TextEncoder().encode(trait.body))
        }, Effect.scoped),
        ls: Effect.gen(function* () {
          const entries = yield* fs.readDirectory(root)
          const traits: Array<Trait> = []
          for (const entry of Array.sort(entries, String.Order)) {
            if (!pipe(entry, String.endsWith(".md"))) continue
            const file = path.join(root, entry)
            const info = yield* fs.stat(file)
            if (info.type !== "File") continue
            const body = yield* fs.readFileString(file)
            traits.push(Trait.make({ id: TraitId.make(pipe(entry, String.slice(0, -3))), body }))
          }
          return traits
        }),
        rm: (traitIds) => Effect.forEach(traitIds, flow(traitPath, fs.remove), { discard: true })
      })
    })
  )
