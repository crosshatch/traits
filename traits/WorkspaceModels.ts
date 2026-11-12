import { Layer } from "effect"

import * as Models from "./Models.ts"
import type { TraitsConfig } from "./TraitsConfig.ts"
import * as WorkspaceConfigProvider from "./WorkspaceConfigProvider.ts"

/** The configured language and decision models, with decision requests limited to the configured concurrency and credentials read from the environment or the workspace's .env files. */
export const layer = (config: TraitsConfig) =>
  Models.layerDecisionLimit(config.concurrency).pipe(
    Layer.provideMerge(Models.layer(config.models).pipe(Layer.provide(WorkspaceConfigProvider.layer)))
  )
