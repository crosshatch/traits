import { Command } from "effect/cli"

import { pull } from "./pull.ts"
import { push } from "./push.ts"
import { sync } from "./sync.ts"

export const cli = Command.make("vcs").pipe(
  Command.withDescription("Move branches between a working copy and its remotes"),
  Command.withSubcommands([pull, push, sync]),
  Command.run({ version: "1.0.0" })
)
