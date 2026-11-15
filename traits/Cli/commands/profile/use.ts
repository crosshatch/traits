import { Array, Console, Effect, Record } from "effect"
import { Argument, CliError, Command } from "effect/cli"

import { ProfileName } from "../../../local/user/Profile/ProfileName.ts"
import * as UserConfig from "../../../local/user/UserConfig.ts"
import { withLock } from "../../../local/user/UserConfigLock.ts"
import { UserPaths } from "../../../local/user/UserPaths.ts"
import { withExperimentalDescription } from "../_common.ts"

export const use = Command.make(
  "use",
  {
    name: Argument.String("name").pipe(Argument.withSchema(ProfileName))
  },
  Effect.fn("profile.use")(function* (params) {
    const { name } = params
    const config = yield* UserConfig.read.pipe(
      Effect.filterOrFail(
        (config) => Array.some(config.profiles, (entry) => entry.name === name),
        () => CliError.UserError.make({ cause: `Unknown profile: ${name}` })
      )
    )
    const { workspaceKey } = yield* UserPaths
    yield* UserConfig.write({
      ...config,
      workspaceProfiles:
        name === "default"
          ? Record.remove(config.workspaceProfiles, workspaceKey)
          : { ...config.workspaceProfiles, [workspaceKey]: name }
    })
    yield* Console.log(`Using profile ${name} for workspace ${workspaceKey}.`)
  }, withLock)
).pipe(withExperimentalDescription("Select the profile this workspace uses"))
