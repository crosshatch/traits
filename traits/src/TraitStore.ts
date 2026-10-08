import { Context, Effect, FileSystem, flow, Layer, Path, PlatformError, Schema as S } from "effect"

import { Trait, TraitId } from "./Trait.ts"

export class TraitNotFound extends S.TaggedError<TraitNotFound>()("TraitNotFound", {
  traitId: TraitId
}) {}

export const TraitStoreError = S.Union([TraitNotFound, S.TaggedStruct("PlatformError", { message: S.String })])

export class TraitStore extends Context.Service<
  TraitStore,
  {
    readonly add: (trait: Trait) => Effect.Effect<void, PlatformError.PlatformError>
    readonly get: (traitId: TraitId) => Effect.Effect<Trait, TraitNotFound | PlatformError.PlatformError>
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
      const root = path.resolve(dir)
      yield* fs.makeDirectory(root, { recursive: true })

      const traitPath = (traitId: TraitId) => path.join(root, `${traitId}.md`)

      return TraitStore.of({
        get: (traitId) =>
          fs.readFileString(traitPath(traitId)).pipe(
            Effect.mapError((error) => (error.reason._tag === "NotFound" ? TraitNotFound.make({ traitId }) : error)),
            Effect.map((body) => Trait.make({ id: traitId, body }))
          ),
        add: (trait) => fs.writeFileString(traitPath(trait.id), trait.body, { flag: "wx" }),
        ls: Effect.gen(function* () {
          const entries = yield* fs.readDirectory(root)
          const traits: Array<Trait> = []
          for (const entry of entries.sort()) {
            if (!entry.endsWith(".md")) continue
            const file = path.join(root, entry)
            const info = yield* fs.stat(file)
            if (info.type !== "File") continue
            const body = yield* fs.readFileString(file)
            traits.push(Trait.make({ id: TraitId.make(entry.slice(0, -3)), body }))
          }
          return traits
        }),
        rm: (traitIds) => Effect.forEach(traitIds, flow(traitPath, fs.remove), { discard: true })
      })
    })
  )
