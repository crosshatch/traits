import { Context, Effect, Layer, Option, Schema as S } from "effect"

import { makeJsonHelpers } from "./jsonHelpers.ts"

export class LockfileStore extends Context.Service<
  LockfileStore,
  {
    readonly pinned: (name: string) => Effect.Effect<Option.Option<string>>
    readonly pin: (name: string, version: string) => Effect.Effect<void>
  }
>()("storage/LockfileStore") {
  static readonly layer = (directory: string) =>
    Layer.effect(
      this,
      Effect.gen(function* () {
        const json = yield* makeJsonHelpers(directory)
        const versions = json.readJson("lock").pipe(
          Effect.flatMap(Option.match({
            onNone: () => Effect.succeed<Readonly<Record<string, string>>>({}),
            onSome: S.decodeUnknownEffect(S.Record(S.String, S.String))
          })),
          Effect.orDie
        )
        return {
          pinned: (name) => Effect.map(versions, (lock) => Option.fromUndefinedOr(lock[name])),
          pin: (name, version) =>
            Effect.flatMap(versions, (lock) => json.writeJson("lock", { ...lock, [name]: version }))
        }
      })
    )
}
