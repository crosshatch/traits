#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Cause, Console, DateTime, Effect, Runtime } from "effect"
import { Digest, SecureRandom } from "effect/crypto"
import { FetchHttpClient } from "effect/http"
import { KeyValueStore, UserDirectories } from "effect/persistence"

import { Cli } from "./Cli/Cli.ts"

// Reports errors on stderr, so stdout carries only command output such as reports and MCP messages.
Cli.pipe(
  Effect.tapCause((cause) =>
    Cause.hasInterruptsOnly(cause) || !Runtime.getErrorReported(Cause.squash(cause))
      ? Effect.void
      : Console.error(Cause.pretty(cause))
  ),
  // Infrastructure for every command, provided once at the program's edge rather than by the services that use it.
  Effect.provide([
    NodeServices.layer,
    FetchHttpClient.layer,
    Digest.layerWebCrypto,
    SecureRandom.layerWebCrypto,
    KeyValueStore.layerMemory,
    DateTime.layerCurrentZoneLocal,
    UserDirectories.layer
  ]),
  (effect) => NodeRuntime.runMain(effect, { disableErrorReporting: true })
)
