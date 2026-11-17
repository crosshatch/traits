import { Context, Effect, Layer, Option } from "effect"

import { makeJsonHelpers } from "./jsonHelpers.ts"

export class SessionStore extends Context.Service<
  SessionStore,
  {
    readonly lastSession: Effect.Effect<Option.Option<unknown>>
    readonly record: (session: unknown) => Effect.Effect<void>
  }
>()("storage/SessionStore") {
  static readonly layer = (directory: string) =>
    Layer.effect(
      this,
      Effect.gen(function* () {
        const json = yield* makeJsonHelpers(directory)
        return {
          lastSession: json.readJson("last-session"),
          record: (session) => json.writeJson("last-session", session)
        }
      })
    )
}
