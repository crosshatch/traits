import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect } from "effect"
import { Command } from "effect/cli"

import { clean } from "./clean.ts"
import { generateMigrations } from "./generate-migrations.ts"
import { syncRepos } from "./sync-repos.ts"
import { traits } from "./traits/main.ts"

Command.make("tasks").pipe(
  Command.withSubcommands([clean, generateMigrations, syncRepos, traits]),
  Command.run({ version: "~" }),
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain
)
