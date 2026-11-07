import { Effect, FileSystem, Layer, Path } from "effect"
import { DecisionModel, LanguageModel, McpServer, Toolkit } from "effect/ai"
import { Digest } from "effect/crypto"
import { ChildProcessSpawner } from "effect/process"

import { TraitDatabase } from "../TraitDatabase.ts"
import { TraitsContext } from "../TraitsContext.ts"
import { TraitStore } from "../TraitStore.ts"
import * as CheckTraits from "./CheckTraits.ts"
import * as DeriveTrait from "./DeriveTrait.ts"

type Services =
  | DecisionModel.DecisionModel
  | LanguageModel.LanguageModel
  | FileSystem.FileSystem
  | Path.Path
  | Digest.Digest
  | ChildProcessSpawner.ChildProcessSpawner
  | TraitDatabase
  | TraitsContext
  | TraitStore

const services = McpServer.middleware<{ readonly provides: Services }>()(
  Effect.map(Effect.context<Services>(), (context) => (effect) => Effect.provide(effect, context))
)

export const toolkit = McpServer.toolkit(Toolkit.merge(DeriveTrait.toolkit, CheckTraits.toolkit)).pipe(
  Layer.provide(services.layer),
  Layer.provide(Layer.mergeAll(DeriveTrait.layer, CheckTraits.layer))
)
