#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect, Layer, Logger } from "effect"
import { Digest } from "effect/crypto"
import { FetchHttpClient } from "effect/http"
import { UserDirectories } from "effect/persistence"

import { Cli } from "./Cli/Cli.ts"
import {
  LocalPaths,
  LocalTraitCollections,
  LocalTraitSelections,
  LocalWorkspaceTraitCollection
} from "./local/index.ts"
import * as Executable from "./util/Executable.ts"

Cli.pipe(
  Effect.provide([LocalWorkspaceTraitCollection.layer, LocalTraitCollections.layer, LocalTraitSelections.layer]),
  Effect.provide(LocalPaths.layer),
  Effect.provide([
    NodeServices.layer,
    FetchHttpClient.layer,
    Digest.layerWebCrypto,
    UserDirectories.layer,
    Executable.layer,
    Layer.succeed(Logger.LogToStderr, true)
  ]),
  NodeRuntime.runMain
)
