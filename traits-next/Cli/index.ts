import { Command } from "effect/cli"

import PackageJson from "../package.json" with { type: "json" }
import { auth } from "./auth.ts"
import { profile } from "./profile.ts"

export const Cli = Command.make("traits").pipe(
  Command.withDescription("Manage trait checking credentials and model profiles"),
  Command.withSubcommands([auth, profile]),
  Command.run({ version: PackageJson.version })
)
