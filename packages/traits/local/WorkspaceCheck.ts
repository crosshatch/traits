import { Context, Effect, Layer } from "effect"

import { check } from "../Check/Check.ts"
import { CurrentSettings } from "../Settings.ts"
import * as LocalDecisionCache from "./LocalDecisionCache.ts"
import * as LocalEnrichmentRegistry from "./LocalEnrichmentRegistry.ts"
import * as LocalSegmenterRegistry from "./LocalSegmenterRegistry.ts"
import * as TraitsConfig from "./TraitsConfig.ts"
import * as WorkspaceChanges from "./WorkspaceChanges.ts"
import * as WorkspaceModels from "./WorkspaceModels.ts"
import * as WorkspaceTraits from "./WorkspaceTraits.ts"

/** Which workspace files to check, and which of the workspace's traits to check them against; every trait by default. */
export interface WorkspaceCheckRequest extends WorkspaceTraits.TraitSelection {
  /** Files to check, relative to the workspace root or absolute within it; every project file when omitted. */
  readonly paths?: ReadonlyArray<string> | undefined
}

/** Checks workspace files against the selected traits, comparing each file's working-tree text with its text at Git HEAD. The given configuration's settings govern the check, whatever settings are in context; the decision model and extension registries come from context, so build the model from the same configuration. */
export const run = Effect.fn("WorkspaceCheck.run")(function* (
  config: TraitsConfig.TraitsConfig,
  request: WorkspaceCheckRequest
) {
  const names = yield* WorkspaceTraits.select(request)
  const { fileConcurrency } = config.check
  const changes = yield* WorkspaceChanges.load({ paths: request.paths, exclude: config.exclude, fileConcurrency })
  const traits = yield* Effect.forEach(
    names,
    (name) => Effect.map(WorkspaceTraits.load(name), (trait) => ({ trait, origin: WorkspaceTraits.origin(name) })),
    { concurrency: fileConcurrency }
  )
  return yield* check({ traits, changes }).pipe(Effect.provideService(CurrentSettings, config))
})

/** Loads traits/config.json, builds its models, fresh extension registries, and the workspace's decision cache, and checks the requested files; returns the report with the verdict policy that configuration sets, if any. */
const checkWorkspace = Effect.fn("WorkspaceCheck.check")(function* (request: WorkspaceCheckRequest) {
  const config = yield* TraitsConfig.load
  const registries = Layer.mergeAll(
    LocalSegmenterRegistry.layer,
    LocalEnrichmentRegistry.layer,
    // Unchanged traits and inputs reuse earlier decisions by the same decision model instead of asking it again.
    LocalDecisionCache.layer(JSON.stringify(config.models.decision))
  ).pipe(Layer.provideMerge(WorkspaceModels.layer(config)))
  const report = yield* run(config, request).pipe(Effect.provide(registries))
  return { report, policy: config.check.policy }
})

/** Checks workspace files against the workspace's traits and configured models; shared by the CLI and the MCP server. */
export class WorkspaceCheck extends Context.Service<WorkspaceCheck>()("traits/local/WorkspaceCheck", {
  make: Effect.gen(function* () {
    const services = yield* Effect.context<Effect.Services<ReturnType<typeof checkWorkspace>>>()
    return {
      /** Checks the requested files, reloading the workspace configuration and trait files on every call; returns the report with the verdict policy check.policy in traits/config.json sets, if any. */
      check: (request: WorkspaceCheckRequest) => checkWorkspace(request).pipe(Effect.provideContext(services))
    }
  })
}) {
  /** The checker; the program provides the platform (filesystem, paths, processes), HTTP, crypto, key-value storage, the time zone, and WorkspaceRoot. */
  static readonly layer = this.make.pipe(Layer.effect(this))
}
