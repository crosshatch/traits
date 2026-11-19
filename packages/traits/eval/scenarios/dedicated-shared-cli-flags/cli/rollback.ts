import { Console, Effect } from "effect"
import { Command, Flag } from "effect/cli"

import { deployFlags } from "./deploy.ts"

export const rollback = Command.make(
  "rollback",
  { ...deployFlags, steps: Flag.Int("steps").pipe(Flag.withDefault(1), Flag.withDescription("Releases to undo")) },
  Effect.fn("rollback")(function* (params) {
    yield* Console.log(`Rolling back ${params.steps} release(s) in ${params.environment} (${params.region})`)
    if (!params.dryRun) {
      yield* Console.log("Rollback started.")
    }
  })
).pipe(Command.withDescription("Roll back recent releases"))
