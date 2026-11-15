import { Context, type Effect, type Schema as S } from "effect"

import type { Change } from "../util/Change.ts"
import type { Segment } from "../util/Segment.ts"
import type { WorkspacePath } from "../util/WorkspacePath.ts"
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
