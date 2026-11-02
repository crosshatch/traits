#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { UserDirectories } from "effect/persistence"

import { Cli } from "./Cli/Cli.ts"
import { UserConfigLock } from "./Cli/UserConfigLock.ts"
import * as WorkspacePaths from "./Cli/WorkspacePaths.ts"
import * as UserConfigStore from "./UserConfigStore/UserConfigStore.ts"
import { UserFileSecurity } from "./UserFileSecurity.ts"

Cli.pipe(
  Effect.provide(
    Layer.mergeAll(UserConfigStore.layerFromFs, UserConfigLock.layer).pipe(
      Layer.provideMerge(UserFileSecurity.layer),
      Layer.provideMerge(WorkspacePaths.layer),
      Layer.provideMerge(UserDirectories.layer),
      Layer.provideMerge(NodeServices.layer)
    )
  ),
  NodeRuntime.runMain
)
