import { Context, type Effect, type Schema as S } from "effect"

import type { Change, Segment, WorkspacePath } from "../util/util.ts"
import type { SegmenterError, SegmenterSetupError } from "./Segmenter.ts"

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
