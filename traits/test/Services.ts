import { NodeServices } from "@effect/platform-node"
import { Effect, FileSystem, Layer } from "effect"
import { FetchHttpClient } from "effect/http"

export const services = Layer.effectDiscard(
  Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeDirectory("/tmp/opencode", { recursive: true }))
).pipe(Layer.provideMerge([NodeServices.layer, FetchHttpClient.layer]))
