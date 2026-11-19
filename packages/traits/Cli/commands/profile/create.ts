import { Console, Effect } from "effect"
import { Argument, CliError, Command, Flag } from "effect/cli"

import * as ModelSelection from "../../../local/user/Profile/ModelSelection.ts"
import { Profile } from "../../../local/user/Profile/Profile.ts"
import { ProfileName } from "../../../local/user/Profile/ProfileName.ts"
import * as Profiles from "../../../local/user/Profiles.ts"
import { withExperimentalDescription } from "../_common.ts"

const selectionFlag = (role: string) =>
  Flag.String(role).pipe(
    Flag.withDescription(
      "Account/model reference or custom .ts layer file (use ./, ../, or an absolute path for directories)"
    ),
    Flag.withSchema(ModelSelection.ModelSelectionFromString),
    Flag.mapEffect((selection) =>
      ModelSelection.resolve(selection).pipe(
        Effect.mapError((error) => CliError.UserError.make({ cause: error.message }))
      )
    )
  )

export const create = Command.make(
  "create",
  {
    name: Argument.String("name").pipe(Argument.withSchema(ProfileName)),
    language: selectionFlag("language"),
    decision: selectionFlag("decision"),
    replace: Flag.Boolean("replace").pipe(Flag.withDefault(false))
  },
  Effect.fn("profile.create")(function* (params) {
    const { name, language, decision, replace } = params
    const profile = Profile.make({ language, decision })
    yield* Profiles.save(name, profile, { replace })
    yield* Console.log(
      `Saved profile ${name}. Model availability and role capabilities are checked when models are resolved.`
    )
  })
).pipe(
  withExperimentalDescription(
    "Save a profile selecting the language and decision models; --replace overwrites one with the same name"
  )
)
