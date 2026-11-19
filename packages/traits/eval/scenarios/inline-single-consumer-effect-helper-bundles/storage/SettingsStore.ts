import { Context, Effect, Layer, Option, Schema as S } from "effect"

import { makeJsonHelpers } from "./jsonHelpers.ts"

const Settings = S.Struct({ theme: S.Literals(["light", "dark"]), telemetry: S.Boolean })

export class SettingsStore extends Context.Service<
  SettingsStore,
  {
    readonly load: Effect.Effect<typeof Settings.Type>
    readonly save: (settings: typeof Settings.Type) => Effect.Effect<void>
  }
>()("storage/SettingsStore") {
  static readonly layer = (directory: string) =>
    Layer.effect(
      this,
      Effect.gen(function* () {
        const json = yield* makeJsonHelpers(directory)
        return {
          load: json.readJson("settings").pipe(
            Effect.flatMap(Option.match({
              onNone: () => Effect.succeed({ theme: "light" as const, telemetry: false }),
              onSome: S.decodeUnknownEffect(Settings)
            })),
            Effect.orDie
          ),
          save: (settings) => json.writeJson("settings", settings)
        }
      })
    )
}
