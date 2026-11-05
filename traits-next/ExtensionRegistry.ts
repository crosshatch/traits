import { Cache, Context, Effect, Exit, Fiber, flow, Predicate, Schema as S, Scope } from "effect"
import { Chat } from "effect/ai"

import { EnrichmentContext } from "./Enrichment/EnrichmentContext.ts"
import * as ExtensionModule from "./ExtensionModule.ts"
import type { ExtensionServices } from "./ExtensionServices.ts"
import type { ModuleSpecifier } from "./util/index.ts"

/** Shares program-scoped setup outcomes and provides isolated execution resources. */
export const make = Effect.fnUntraced(function* <A, E, E2>(
  result: S.ConstraintDecoder<A>,
  error: S.Constraint & { readonly Type: E },
  executionError: S.Constraint & { readonly Type: E2 }
) {
  const scope = yield* Scope.Scope
  const services = yield* Effect.context<Exclude<ExtensionServices, Scope.Scope | Chat.Chat>>().pipe(
    Effect.map(Context.omit(Scope.Scope, Chat.Chat, EnrichmentContext))
  )
  const provide = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(Effect.provideContext(services), Effect.provideServiceEffect(Chat.Chat, Chat.empty))
  const setups = yield* Cache.make({
    capacity: Infinity,
    lookup: Effect.fnUntraced(
      function* (module: ModuleSpecifier) {
        const child = yield* Scope.fork(scope)
        return ExtensionModule.load(module, result, error).pipe(
          provide,
          Scope.provide(child),
          Effect.onError((cause) => Scope.close(child, Exit.failCause(cause)))
        )
      },
      Effect.flatten,
      Effect.forkIn(scope)
    )
  })
  return {
    get: (module: ModuleSpecifier) => Cache.get(setups, module).pipe(Effect.flatMap(Fiber.join)),
    run: flow(provide, Effect.scoped, Effect.catchIf(Predicate.not(S.is(executionError)), Effect.die))
  }
})
