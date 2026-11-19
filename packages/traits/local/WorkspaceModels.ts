import { Layer } from "effect"

import * as DecisionBatching from "../DecisionBatching.ts"
import * as DecisionLimit from "../DecisionLimit.ts"
import { CurrentSettings } from "../Settings.ts"
import * as Models from "./Models.ts"
import type { TraitsConfig } from "./TraitsConfig.ts"
import * as WorkspaceConfigProvider from "./WorkspaceConfigProvider.ts"

/** The configured decision model with request batching, limits, retries, workspace credentials, and the corresponding settings. */
export const layerDecision = (config: TraitsConfig) =>
  DecisionBatching.layer.pipe(
    Layer.provideMerge(DecisionLimit.layer),
    Layer.provideMerge(Models.layerDecision(config.models.decision).pipe(Layer.provide(WorkspaceConfigProvider.layer))),
    Layer.provideMerge(Layer.succeed(CurrentSettings, config))
  )

/** The configured language model with workspace credentials, without constructing an unused decision model. */
export const layerLanguage = (config: TraitsConfig) =>
  Models.layerLanguage(config.models.language).pipe(Layer.provide(WorkspaceConfigProvider.layer))

/** Both workspace models and their settings, for checks and derivation. */
export const layer = (config: TraitsConfig) => Layer.mergeAll(layerDecision(config), layerLanguage(config))
