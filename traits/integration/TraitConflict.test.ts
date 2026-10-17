import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/http"

import * as TraitsConfigProvider from "../_util/TraitsConfigProvider.ts"
import * as Trait from "../Trait.ts"
import * as TraitConflict from "../TraitConflict.ts"
import * as TraitsConfig from "../TraitsConfig.ts"

const layer = TraitsConfig.layer.pipe(
  Layer.provideMerge(FetchHttpClient.layer),
  Layer.provide(TraitsConfigProvider.layer),
  Layer.provideMerge(NodeServices.layer)
)

const callbacks = Trait.Trait.make({
  name: Trait.TraitName.make("direct-callbacks"),
  body: "Pass compatible functions directly as callbacks instead of wrapping them in forwarding arrows. Retain wrappers needed to preserve the receiver or control forwarded arguments.",
  when: "passing callbacks.",
  mime: "text/typescript"
})
const broaderProposal =
  "Pass compatible functions directly instead of wrapping them in forwarding arrows, both for callbacks and service method definitions. Use a curried library overload directly when it produces the required function. Retain wrappers needed to preserve the receiver or control forwarded arguments."

it.effect(
  "recognizes a genuinely covered preference with the configured decision model",
  Effect.fnUntraced(function* () {
    const result = yield* TraitConflict.check(callbacks, callbacks.body)
    expect(TraitConflict.TraitConflict.guards.Covered(result)).toBe(true)
  }, Effect.provide(layer))
)

it.effect(
  "does not claim a callback-only trait fully covers forwarding service methods",
  Effect.fnUntraced(function* () {
    const result = yield* TraitConflict.check(callbacks, broaderProposal)
    expect(TraitConflict.TraitConflict.guards.Covered(result)).toBe(false)
    if (TraitConflict.TraitConflict.guards.Fail(result)) {
      expect(result.reason).toBe("coverage_gap")
    }
  }, Effect.provide(layer))
)
