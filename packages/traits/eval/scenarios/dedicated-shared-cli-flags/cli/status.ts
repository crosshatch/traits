import { Console, Effect } from "effect"
import { Command } from "effect/cli"

import { deployFlags } from "./deploy.ts"

export const status = Command.make(
  "status",
  { environment: deployFlags.environment, region: deployFlags.region },
  Effect.fn("status")(function* (params) {
    yield* Console.log(`Fetching release status for ${params.environment} in ${params.region}`)
  })
).pipe(Command.withDescription("Show the current release"))
