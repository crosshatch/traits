import { Command } from "effect/cli"

import { withExperimentalDescription } from "../_common.ts"
import { create } from "./create.ts"
import { list } from "./list.ts"
import { remove } from "./remove.ts"
import { show } from "./show.ts"
import { use } from "./use.ts"

export const profile = Command.make("profile").pipe(
  withExperimentalDescription("Manage user-level model profiles; checks do not use them yet"),
  Command.withSubcommands([create, list, show, use, remove])
)
