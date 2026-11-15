import { Layer } from "effect"

import * as DecisionBatching from "../DecisionBatching.ts"
import * as DecisionLimit from "../DecisionLimit.ts"
import { CurrentSettings } from "../Settings.ts"
import * as Models from "./Models.ts"
import type { TraitsConfig } from "./TraitsConfig.ts"
import * as WorkspaceConfigProvider from "./WorkspaceConfigProvider.ts"

/** The configured language and decision models, with concurrent decisions about one input batched and decision requests limited and retried as the configuration's settings direct, and credentials read from the environment or the workspace's .env files. Also provides those settings, so everything run with these models follows the same configuration. */
export const layer = (config: TraitsConfig) =>
  DecisionBatching.layer.pipe(
    Layer.provideMerge(DecisionLimit.layer),
    Layer.provideMerge(Models.layer(config.models).pipe(Layer.provide(WorkspaceConfigProvider.layer))),
    Layer.provideMerge(Layer.succeed(CurrentSettings, config))
  )
