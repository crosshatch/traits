import { Layer } from "effect"

import * as DecisionBatching from "../DecisionBatching.ts"
import * as Models from "../Models.ts"
import type { TraitsConfig } from "./TraitsConfig.ts"
import * as WorkspaceConfigProvider from "./WorkspaceConfigProvider.ts"

/** The configured language and decision models, with concurrent decisions about one input batched, decision requests limited to the configured concurrency, and credentials read from the environment or the workspace's .env files. */
export const layer = (config: TraitsConfig) =>
  DecisionBatching.layer.pipe(
    Layer.provideMerge(Models.layerDecisionLimit(config.concurrency)),
    Layer.provideMerge(Models.layer(config.models).pipe(Layer.provide(WorkspaceConfigProvider.layer)))
  )
