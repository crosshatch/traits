import { Effect, Layer } from "effect"

import * as LocalProjectFiles from "./LocalProjectFiles.ts"
import * as LocalTraitCollections from "./LocalTraitCollections.ts"
import * as LocalTraitSelections from "./LocalTraitSelections.ts"
import * as LocalWorkspaceTraitCollection from "./LocalWorkspaceTraitCollection.ts"
import * as Segmentation from "./Segmentation/Segmentation.ts"
import * as TraitsConfig from "./TraitsConfig/TraitsConfig.ts"

/** The workspace's own traits, its collections from declared sources, and its selections, kept in its traits directory. The workspace's paths are provided to it, such as by LocalPaths.layer. */
export const layer = Layer.mergeAll(
  LocalWorkspaceTraitCollection.layer,
  LocalTraitCollections.layer,
  LocalTraitSelections.layer
)

/** What a run of the workspace's traits is handed, by the configuration as it is now: the project's files, less those it excludes, and how they are divided into segments. The configuration is returned with them, for what else it says, such as which model to ask. */
export const prepareRun = Effect.gen(function* () {
  const config = yield* TraitsConfig.load
  const files = yield* LocalProjectFiles.make(config.exclude)
  return { config, files, segmentation: Segmentation.prepare(config.segmentation) }
}).pipe(Effect.withSpan("LocalWorkspace.prepareRun"))
