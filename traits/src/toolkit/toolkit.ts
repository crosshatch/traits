import { Layer } from "effect"
import { McpServer, Toolkit } from "effect/ai"

import * as CheckTraitExpression from "./CheckTraitExpression.ts"
import * as DeriveTrait from "./DeriveTrait.ts"
import * as ResolveConflictingTraits from "./ResolveConflictingTraits.ts"

export const toolkit = McpServer.toolkit(
  Toolkit.merge(DeriveTrait.toolkit, ResolveConflictingTraits.toolkit, CheckTraitExpression.toolkit)
).pipe(Layer.provide(Layer.mergeAll(DeriveTrait.layer, ResolveConflictingTraits.layer, CheckTraitExpression.layer)))
