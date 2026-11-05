#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect } from "effect"

import { Cli } from "./Cli/Cli.ts"

Cli.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain)
