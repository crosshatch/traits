import { Command } from "effect/cli"

import PackageJson from "../package.json" with { type: "json" }
import { run } from "./run.ts"
import { upgrade } from "./upgrade.ts"

export const Cli = Command.make("traits").pipe(
  Command.withDescription("Add trait sources, check files against traits, and serve traits over MCP."),
  Command.withSubcommands([run, upgrade]),
  Command.run({ version: PackageJson.version })
)
