import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Console, Effect, Layer } from "effect"
import { Reactivity } from "effect/reactivity"

import * as TraitProjectLock from "../../_util/TraitProjectLock.ts"
import { ProjectPaths } from "../../ProjectPaths.ts"

Effect.gen(function* () {
  yield* TraitProjectLock.acquire
  yield* Console.log("ready")
  return yield* Effect.never
}).pipe(
  Effect.scoped,
  Effect.provide([
    NodeServices.layer,
    Reactivity.layer,
    Layer.succeed(ProjectPaths, { projectRoot: process.argv[2]!, traitsDirectory: process.argv[2]! })
  ]),
  NodeRuntime.runMain
)
