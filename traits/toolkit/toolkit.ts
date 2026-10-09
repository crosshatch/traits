import { Layer } from "effect"
import { McpServer, Toolkit } from "effect/ai"

import * as CheckTraits from "./CheckTraits.ts"
import * as DeriveTrait from "./DeriveTrait.ts"

export const toolkit = McpServer.toolkit(Toolkit.merge(DeriveTrait.toolkit, CheckTraits.toolkit)).pipe(
  Layer.provide(Layer.mergeAll(DeriveTrait.layer, CheckTraits.layer))
)
