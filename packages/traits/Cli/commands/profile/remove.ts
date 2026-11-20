import { Console, Effect } from "effect"
import { Argument, Command, Flag } from "effect/cli"

import { ProfileName } from "../../../local/user/Profile/ProfileName.ts"
import * as Profiles from "../../../local/user/Profiles.ts"
import { withExperimentalDescription } from "../_common.ts"

export const remove = Command.make(
  "remove",
  {
    name: Argument.String("name").pipe(Argument.withSchema(ProfileName)),
    force: Flag.Boolean("force").pipe(
      Flag.withDescription("Allow removing the default profile or clearing workspace references"),
      Flag.withDefault(false)
    )
  },
  Effect.fn("profile.remove")(function* (params) {
    const { name } = params
    yield* Profiles.remove(name, { force: params.force })
    yield* Console.log(`Removed profile ${name}.`)
  })
).pipe(
  withExperimentalDescription("Remove a profile; --force also removes the default profile or one a workspace uses")
)
