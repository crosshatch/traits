import { Array, Console, Effect } from "effect"
import { Argument, CliError, Command } from "effect/cli"

import { ProfileName } from "../../../Profile/ProfileName.ts"
import { UserConfigStore } from "../../../UserConfigStore/UserConfigStore.ts"
import { UserConfigLock } from "../../UserConfigLock.ts"

export const remove = Command.make(
  "remove",
  { name: Argument.String("name").pipe(Argument.withSchema(ProfileName)) },
  Effect.fn("profile.remove")(function* (params) {
    const { readConfig, writeConfig } = yield* UserConfigStore
    const withLock = yield* UserConfigLock
    const { name } = params
    yield* Effect.gen(function* () {
      const config = yield* readConfig.pipe(
        Effect.filterOrFail(
          (config) => Array.some(config.profiles, (entry) => entry.name === name),
          () => CliError.UserError.make({ cause: `Unknown profile: ${name}` })
        )
      )
      yield* writeConfig({
        profiles: Array.filter(config.profiles, (entry) => entry.name !== name),
        ...(config.activeProfile !== undefined && config.activeProfile !== name
          ? { activeProfile: config.activeProfile }
          : {})
      })
    }).pipe(withLock)
    yield* Console.log(`Removed profile ${name}.`)
  })
)
