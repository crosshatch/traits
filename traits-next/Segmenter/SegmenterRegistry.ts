import { Context, Effect, flow, Layer, Predicate, Schema as S } from "effect"

import * as ExtensionRegistry from "../ExtensionRegistry.ts"
import type { Segmenter } from "./Segmenter.ts"
import { SegmenterError } from "./SegmenterError.ts"
import { SegmenterSetupError } from "./SegmenterSetupError.ts"

/** Program-scoped segmenter setup with fresh execution chats and scopes. */
export class SegmenterRegistry extends Context.Service<SegmenterRegistry>()("traits-next/Segmenter/SegmenterRegistry", {
  make: Effect.gen(function* () {
    const registry = yield* ExtensionRegistry.make(
      S.declare((value): value is Effect.Success<Segmenter> => Predicate.isFunction(value)),
      SegmenterSetupError,
      SegmenterError
    )
    return flow(
      registry.get,
      Effect.map((execute) => flow(execute, registry.run))
    )
  })
}) {
  static readonly layer = this.make.pipe(Layer.effect(this))
}
