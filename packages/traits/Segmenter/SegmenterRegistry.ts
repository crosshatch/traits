import { Context, Effect, flow, Layer, type Schema as S, type Scope } from "effect"
import type { Chat } from "effect/ai"

import * as ExtensionRuntime from "../ExtensionRuntime.ts"
import type { Change } from "../util/Change.ts"
import type { Segment } from "../util/Segment.ts"
import type { WorkspacePath } from "../util/WorkspacePath.ts"
import type { SegmenterError, SegmenterSetupError } from "./Segmenter.ts"
import * as Segmenter from "./Segmenter.ts"

/** Program-scoped segmenter setup with fresh execution chats and scopes. */
export class SegmenterRegistry extends Context.Service<
  SegmenterRegistry,
  (
    module: WorkspacePath
  ) => Effect.Effect<
    (change: Change) => Effect.Effect<ReadonlyArray<Segment>, SegmenterError>,
    SegmenterSetupError | S.SchemaError
  >
>()("traits/Segmenter/SegmenterRegistry") {}

/** Builds a scoped registry from caller-supplied setup effects. Only the services used by these extensions are required. Identities remain normalized logical workspace paths; no files are loaded. */
export const layer = <R>(
  setup: (
    module: WorkspacePath
  ) => Effect.Effect<
    (change: Change) => Effect.Effect<ReadonlyArray<Segment>, SegmenterError, R | Scope.Scope | Chat.Chat>,
    SegmenterSetupError | S.SchemaError,
    R | Scope.Scope | Chat.Chat
  >
) =>
  Layer.effect(
    SegmenterRegistry,
    Effect.gen(function* () {
      const { get, run } = yield* ExtensionRuntime.make(setup, Segmenter.SegmenterError)
      return flow(
        get,
        Effect.map((execute) => flow(execute, run))
      )
    })
  )
