import { Layer } from "effect"

import * as DecisionBatching from "../DecisionBatching.ts"
import * as Models from "../Models.ts"
import type { TraitsConfig } from "./TraitsConfig.ts"
import * as WorkspaceConfigProvider from "./WorkspaceConfigProvider.ts"

/** The configured language and decision models, with concurrent decisions about one input batched and decision requests limited and retried as the settings in context direct, and credentials read from the environment or the workspace's .env files. */
export const layer = (config: TraitsConfig) =>
  DecisionBatching.layer.pipe(
    Layer.provideMerge(Models.layerDecisionLimit),
    Layer.provideMerge(Models.layer(config.models).pipe(Layer.provide(WorkspaceConfigProvider.layer)))
  )
