#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect } from "effect"

import { Cli } from "./Cli/index.ts"

Cli.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain)
