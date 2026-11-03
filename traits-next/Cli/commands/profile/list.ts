import { Console, Effect } from "effect"
import { Command } from "effect/cli"

import { UserConfigStore } from "../../../UserConfigStore.ts"

export const list = Command.make(
  "list",
  {},
  Effect.fn("profile.list")(function* () {
    const { readConfig } = yield* UserConfigStore
    const config = yield* readConfig
    if (config.profiles.length === 0) {
      return yield* Console.log("No profiles configured.")
    }
    for (const entry of config.profiles)
      yield* Console.log(`${entry.name === config.activeProfile ? "*" : " "} ${entry.name}`)
  })
)
