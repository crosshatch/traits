import { Context, DateTime, Effect, Layer, Semaphore } from "effect"
import { Digest, SecureRandom } from "effect/crypto"
import { FetchHttpClient } from "effect/http"
import { KeyValueStore } from "effect/persistence"

import * as TraitDerivation from "./TraitDerivation.ts"
import type { TraitDocument } from "./TraitFile.ts"
import * as TraitsConfig from "./TraitsConfig.ts"
import * as WorkspaceModels from "./WorkspaceModels.ts"

/** Asks the user whether to save one proposal; the host supplies it, for example as an MCP elicitation form. */
export type Approve<E> = (request: TraitDerivation.ApprovalRequest) => Effect.Effect<TraitDerivation.Approval, E>

/** Derives proposals in order with the workspace's configured models, so each sees traits saved by earlier ones. */
const deriveWorkspace = Effect.fn("WorkspaceDerive.derive")(function* <E>(
  documents: ReadonlyArray<TraitDocument>,
  approve: Approve<E>
) {
  const config = yield* TraitsConfig.load
  return yield* Effect.forEach(documents, (document) => TraitDerivation.derive(document, approve)).pipe(
    Effect.provide(WorkspaceModels.layer(config))
  )
})

/** Derives proposed traits into the workspace's trait files after user approval; shared by hosts such as the MCP server. */
export class WorkspaceDerive extends Context.Service<WorkspaceDerive>()("traits/WorkspaceDerive", {
  make: Effect.gen(function* () {
    const services = yield* Effect.context<Effect.Services<ReturnType<typeof deriveWorkspace<never>>>>()
    // One derivation at a time, so approvals and writes never interleave.
    const lock = yield* Semaphore.make(1)
    return {
      /** Compares, approves, and saves each proposal in order, reloading the configuration and trait files on every call. */
      derive: <E>(documents: ReadonlyArray<TraitDocument>, approve: Approve<E>) =>
        deriveWorkspace(documents, approve).pipe(lock.withPermits(1), Effect.provideContext(services))
    }
  })
}) {
  /** The deriver with default host services; the host provides the platform (filesystem, paths, processes) and WorkspaceRoot. */
  static readonly layer = this.make.pipe(
    Layer.effect(this),
    Layer.provide([
      FetchHttpClient.layer,
      Digest.layerWebCrypto,
      SecureRandom.layerWebCrypto,
      KeyValueStore.layerMemory,
      DateTime.layerCurrentZoneLocal
    ])
  )
}
