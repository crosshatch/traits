import { Console, Effect } from "effect"
import { Command } from "effect/cli"

import * as UserConfig from "../../../local/UserConfig.ts"
import { withExperimentalDescription } from "../_common.ts"

export const list = Command.make(
  "list",
  {},
  Effect.fn("profile.list")(function* () {
    const config = yield* UserConfig.read
    if (config.profiles.length === 0) {
      return yield* Console.log("No profiles configured.")
    }
    const selected = yield* UserConfig.resolveProfile(config)
    for (const entry of config.profiles) yield* Console.log(`${entry.name === selected.name ? "*" : " "} ${entry.name}`)
  })
).pipe(withExperimentalDescription("List profiles, marking the one this workspace uses"))
