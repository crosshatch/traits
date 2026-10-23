import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect } from "effect"
import { Command } from "effect/cli"
import { FetchHttpClient } from "effect/http"

import { bench } from "./bench/bench.ts"
import { clean } from "./clean.ts"
import { generateProto } from "./generate-proto.ts"
import { syncRepos } from "./sync-repos.ts"

Command.make("tasks").pipe(
  Command.withSubcommands([clean, syncRepos, bench, generateProto]),
  Command.run({ version: "~" }),
  Effect.provide([NodeServices.layer, FetchHttpClient.layer]),
  NodeRuntime.runMain
)
