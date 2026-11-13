import { Command } from "effect/cli"

import { build } from "./build.ts"
import { deploy } from "./deploy.ts"
import { rollback } from "./rollback.ts"
import { status } from "./status.ts"

export const cli = Command.make("ship").pipe(
  Command.withDescription("Build and release the service"),
  Command.withSubcommands([build, deploy, rollback, status]),
  Command.run({ version: "1.0.0" })
)
