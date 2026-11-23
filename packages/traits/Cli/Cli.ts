import { Console, Effect, Layer, pipe, String } from "effect"
import { CliError, Command } from "effect/cli"

import * as LocalDefaultTraitCollection from "../local/LocalDefaultTraitCollection.ts"
import * as LocalPaths from "../local/LocalPaths.ts"
import * as LocalTraitCollections from "../local/LocalTraitCollections.ts"
import * as LocalTraitSelections from "../local/LocalTraitSelections.ts"
import PackageJson from "../package.json" with { type: "json" }
import { CommandExit } from "./CommandExit.ts"
import { run } from "./run.ts"
import { upgrade } from "./upgrade.ts"

/** The workspace found from the current directory. Every command that works in one is given it below, so that none builds its own. */
const workspace = Layer.mergeAll(
  LocalDefaultTraitCollection.layer,
  LocalTraitCollections.layer,
  LocalTraitSelections.layer
).pipe(Layer.provideMerge(LocalPaths.layer))

export const Cli = Command.make("traits").pipe(
  Command.withDescription("Commands for working with traits."),
  // A command that does not work in a workspace, such as upgrade, is left to run anywhere.
  Command.withSubcommands([Command.provide(run, workspace), upgrade]),
  Command.run({ version: PackageJson.version }),
  // A failure that no command dealt with kept it from its work: the reason is printed, and the command ends as one that could not do what was asked. What the command line itself reports, such as a misspelt flag, has been printed already.
  Effect.catchIf(
    (error) => !CliError.isCliError(error) && !(error._tag === "CommandExit" && error.reason === undefined),
    (error) =>
      Console.error(
        error._tag === "CommandExit"
          ? (error.reason ?? "")
          : error._tag === "ConfigError"
            ? // The provider's key is read from the environment, and its own error only names the variable in passing.
              `Could not read the credentials for the models in traits/config.json from the environment: ${pipe(error.message, String.replaceAll(/\s+/gu, " "))}. Set the variable it names, or name a .env file that sets it with --dotenv, then run again.`
            : error.message
      ).pipe(Effect.andThen(CommandExit.make({ code: error._tag === "CommandExit" ? error.code : 2 })))
  )
)
