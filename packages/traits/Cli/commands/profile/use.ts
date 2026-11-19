import { Console, Effect } from "effect"
import { Argument, Command } from "effect/cli"

import { ProfileName } from "../../../local/user/Profile/ProfileName.ts"
import * as Profiles from "../../../local/user/Profiles.ts"
import { withExperimentalDescription } from "../_common.ts"

export const use = Command.make(
  "use",
  {
    name: Argument.String("name").pipe(Argument.withSchema(ProfileName))
  },
  Effect.fn("profile.use")(function* (params) {
    const { name } = params
    const { workspaceKey } = yield* Profiles.use(name)
    yield* Console.log(`Using profile ${name} for workspace ${workspaceKey}.`)
  })
).pipe(withExperimentalDescription("Select the profile this workspace uses"))
