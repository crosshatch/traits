import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Console, Effect, FileSystem, Layer } from "effect"
import { Reactivity } from "effect/reactivity"

import * as TraitDatabase from "../../TraitDatabase.ts"
import * as TraitWriteLock from "../../TraitWriteLock.ts"

const [databaseFile, traitFile, contents] = process.argv.slice(2)

// Another Traits process: rewrites a trait while holding the worktree write lock.
Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const lock = yield* TraitWriteLock.TraitWriteLock
  yield* lock.withLock(
    Effect.gen(function* () {
      yield* Console.log("locked")
      yield* Effect.sleep("300 millis")
      yield* fs.writeFileString(traitFile!, contents!)
    })
  )
}).pipe(
  Effect.provide(TraitWriteLock.layer.pipe(Layer.provide(TraitDatabase.layerFile(databaseFile!)))),
  Effect.provide([NodeServices.layer, Reactivity.layer]),
  NodeRuntime.runMain
)
