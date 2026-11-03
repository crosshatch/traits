import { Array, Console, Effect, Record } from "effect"
import { Argument, CliError, Command } from "effect/cli"

import { ProfileName } from "../../Profile/ProfileName.ts"
import * as UserConfig from "../../UserConfig.ts"
import { withLock } from "../../UserConfigLock.ts"
import * as WorkspacePaths from "../../WorkspacePaths.ts"

export const use = Command.make(
  "use",
  {
    name: Argument.String("name").pipe(Argument.withSchema(ProfileName))
  },
  Effect.fn("profile.use")(
    function* (params) {
      const { name } = params
      const config = yield* UserConfig.read.pipe(
        Effect.filterOrFail(
          (config) => Array.some(config.profiles, (entry) => entry.name === name),
          () => CliError.UserError.make({ cause: `Unknown profile: ${name}` })
        )
      )
      const workspace = yield* WorkspacePaths.root
      yield* UserConfig.write({
        ...config,
        workspaceProfiles:
          name === "default"
            ? Record.remove(config.workspaceProfiles, workspace)
            : { ...config.workspaceProfiles, [workspace]: name }
      })
      return `workspace ${workspace}`
    },
    withLock,
    (effect, params) =>
      effect.pipe(Effect.flatMap((target) => Console.log(`Using profile ${params.name} for ${target}.`)))
  )
)
