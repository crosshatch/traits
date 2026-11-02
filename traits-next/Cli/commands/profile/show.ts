import { Array, Console, Effect, Option } from "effect"
import { Argument, CliError, Command } from "effect/cli"

import { ProfileName } from "../../../Profile/ProfileName.ts"
import { UserConfigStore } from "../../../UserConfigStore/UserConfigStore.ts"

export const show = Command.make(
  "show",
  {
    name: Argument.String("name").pipe(Argument.withSchema(ProfileName), Argument.optional)
  },
  Effect.fn("profile.show")(function* (params) {
    const { readConfig } = yield* UserConfigStore
    const config = yield* readConfig
    const selected = Option.getOrElse(params.name, () => config.activeProfile)
    const entry = Option.getOrUndefined(Array.findFirst(config.profiles, (profile) => profile.name === selected))
    if (entry === undefined) {
      return yield* CliError.UserError.make({
        cause:
          selected !== undefined
            ? `Unknown profile: ${selected}`
            : "No active profile. Run traits profile create first."
      })
    }
    yield* Console.log(JSON.stringify(entry, null, 2))
  })
)
