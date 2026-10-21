import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect } from "effect"
import { Command } from "effect/cli"

import { bench } from "./bench/bench.ts"
import { clean } from "./clean.ts"
import { syncRepos } from "./sync-repos.ts"

Command.make("tasks").pipe(
  Command.withSubcommands([clean, syncRepos, bench]),
  Command.run({ version: "~" }),
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain
)
