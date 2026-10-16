import { NodeServices } from "@effect/platform-node"
import { Effect, FileSystem, Layer } from "effect"
import { FetchHttpClient } from "effect/http"

export const layer = Layer.effectDiscard(
  Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeDirectory("/tmp/opencode", { recursive: true }))
).pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer)))
