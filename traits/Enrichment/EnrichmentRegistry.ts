import { Context, type Effect, type Schema as S } from "effect"

import type { WorkspacePath } from "../util/util.ts"
import type { EnrichmentSetupError } from "./Enrichment.ts"
import type { EnrichmentContext } from "./EnrichmentContext.ts"
import type { EnrichmentError } from "./EnrichmentError.ts"

/** Program-scoped enrichment setup with invocation-local context, chat, and scope. */
export class EnrichmentRegistry extends Context.Service<
  EnrichmentRegistry,
  (
    module: WorkspacePath
  ) => Effect.Effect<
    Effect.Effect<string, EnrichmentError | S.SchemaError, EnrichmentContext>,
    EnrichmentSetupError | S.SchemaError
  >
>()("traits/Enrichment/EnrichmentRegistry") {}
