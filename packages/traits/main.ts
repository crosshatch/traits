#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { DateTime, Effect } from "effect"
import { Digest, SecureRandom } from "effect/crypto"
import { FetchHttpClient } from "effect/http"
import { KeyValueStore, UserDirectories } from "effect/persistence"

import { Cli } from "./Cli/Cli.ts"

Cli.pipe(
  Effect.provide([
    NodeServices.layer,
    FetchHttpClient.layer,
    Digest.layerWebCrypto,
    SecureRandom.layerWebCrypto,
    KeyValueStore.layerMemory,
    DateTime.layerCurrentZoneLocal,
    UserDirectories.layer
  ]),
  NodeRuntime.runMain
)
