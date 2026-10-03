import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect } from "effect"
import { Command } from "effect/cli"

import { clean } from "./clean.ts"
import { generateMigrations } from "./generate-migrations.ts"
import { syncRepos } from "./sync-repos.ts"

Command.make("tools").pipe(
  Command.withSubcommands([clean, generateMigrations, syncRepos]),
  Command.run({ version: "~" }),
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain
)
