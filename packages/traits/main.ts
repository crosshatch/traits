#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Cause, Console, DateTime, Effect, Logger, Option, pipe, Predicate, Runtime } from "effect"
import { Digest, SecureRandom } from "effect/crypto"
import { FetchHttpClient } from "effect/http"
import { KeyValueStore, UserDirectories } from "effect/persistence"

import { Cli } from "./Cli/Cli.ts"

// Reports errors on stderr, so stdout carries only command output such as reports and MCP messages. An expected
// failure's message says what to fix, so only defects, which are bugs, are reported with their full cause.
Cli.pipe(
  Effect.tapCause((cause) =>
    Cause.hasInterruptsOnly(cause) || !Runtime.getErrorReported(Cause.squash(cause))
      ? Effect.void
      : Console.error(
          pipe(
            Cause.findErrorOption(cause),
            Option.filter(() => !Cause.hasDies(cause)),
            Option.filter(Predicate.isError),
            Option.match({ onNone: () => Cause.pretty(cause), onSome: (error) => error.message })
          )
        )
  ),
  // Logs also go to stderr, so they never mix with a report or the MCP protocol stream on stdout.
  Effect.provideService(Logger.LogToStderr, true),
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
