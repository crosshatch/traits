import { Context, Effect, Option } from "effect"

export interface KeyValueShape {
  readonly get: (key: string) => Effect.Effect<Option.Option<string>>
  readonly set: (key: string, value: string) => Effect.Effect<void>
}

export class Cache extends Context.Service<Cache, KeyValueShape>()("services/Cache") {}
