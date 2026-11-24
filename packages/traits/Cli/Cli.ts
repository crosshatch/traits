import { Command } from "effect/cli"

import PackageJson from "../package.json" with { type: "json" }
import { run } from "./commands/run.ts"
import { upgrade } from "./commands/upgrade.ts"

export const Cli = Command.make("traits").pipe(
  Command.withDescription("Commands for working with traits."),
  Command.withSubcommands([run, upgrade]),
  Command.run({ version: PackageJson.version })
)
