import { Effect, flow, Layer, Predicate, Schema as S } from "effect"

import * as Segmenter from "../Segmenter/Segmenter.ts"
import { SegmenterRegistry } from "../Segmenter/SegmenterRegistry.ts"
import * as ExtensionRegistry from "./ExtensionRegistry.ts"

/** Program-scoped segmenter setup from workspace modules, with fresh execution chats and scopes. */
export const layer = Layer.effect(
  SegmenterRegistry,
  Effect.gen(function* () {
    const { get, run } = yield* ExtensionRegistry.make(
      S.declare((value): value is Effect.Success<Segmenter.Segmenter> => Predicate.isFunction(value)),
      Segmenter.SegmenterSetupError,
      Segmenter.SegmenterError
    )
    return flow(
      get,
      Effect.map((execute) => flow(execute, run))
    )
  })
)
