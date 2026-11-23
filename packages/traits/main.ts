#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect } from "effect"
import { Digest } from "effect/crypto"
import { FetchHttpClient } from "effect/http"
import { UserDirectories } from "effect/persistence"

import { Cli } from "./Cli/Cli.ts"

Cli.pipe(
  Effect.provide([NodeServices.layer, FetchHttpClient.layer, Digest.layerWebCrypto, UserDirectories.layer]),
  NodeRuntime.runMain
)
