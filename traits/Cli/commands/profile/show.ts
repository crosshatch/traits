import { Console, Effect, Option } from "effect"
import { Argument, Command } from "effect/cli"

import { ProfileName } from "../../../local/user/Profile/ProfileName.ts"
import * as Profiles from "../../../local/user/Profiles.ts"
import { withExperimentalDescription } from "../_common.ts"

export const show = Command.make(
  "show",
  {
    name: Argument.String("name").pipe(Argument.withSchema(ProfileName), Argument.optional)
  },
  Effect.fn("profile.show")(function* (params) {
    const entry = yield* Profiles.get(Option.getOrUndefined(params.name))
    yield* Console.log(JSON.stringify(entry, null, 2))
  })
).pipe(withExperimentalDescription("Print a profile as JSON; this workspace's profile when no name is given"))
