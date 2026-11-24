#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect, Layer, Logger } from "effect"
import { Digest } from "effect/crypto"
import { FetchHttpClient } from "effect/http"
import { UserDirectories } from "effect/persistence"

import { Cli } from "./Cli/Cli.ts"

Cli.pipe(
  Effect.provide([
    NodeServices.layer,
    FetchHttpClient.layer,
    Digest.layerWebCrypto,
    UserDirectories.layer,
    // Logs go to standard error, which leaves standard output to what a command prints, such as a report as JSON.
    Layer.succeed(Logger.LogToStderr, true)
  ]),
  NodeRuntime.runMain
)
