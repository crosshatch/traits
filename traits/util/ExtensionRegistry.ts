import { Cache, Effect, Exit, Fiber, Predicate, Schema as S, Scope } from "effect"
import { Chat } from "effect/ai"

import type { WorkspacePath } from "./WorkspacePath.ts"

/** Internal lifecycle shared by explicitly supplied extensions; no module imports or platform services. */
export const make = Effect.fnUntraced(
  function* <A, E, E2, R>(
    setup: (module: WorkspacePath) => Effect.Effect<A, E, R | Scope.Scope | Chat.Chat>,
    executionError: S.Constraint & { readonly Type: E2 }
  ) {
    const scope = yield* Scope.Scope
    const services = yield* Effect.context<R>()
    const provide = <A, E, R2>(effect: Effect.Effect<A, E, R2>) =>
      effect.pipe(Effect.provideServiceEffect(Chat.Chat, Chat.empty), Effect.provideContext(services))
    const setups = yield* Cache.make({
      capacity: Infinity,
      lookup: Effect.fnUntraced(
        function* (module: WorkspacePath) {
          const child = yield* Scope.fork(scope)
          return setup(module).pipe(
            Scope.provide(child),
            provide,
            Effect.onError((cause) => Scope.close(child, Exit.failCause(cause)))
          )
        },
        Effect.flatten,
        Effect.forkIn(scope)
      )
    })
    return {
      get: (module: WorkspacePath) => Cache.get(setups, module).pipe(Effect.flatMap(Fiber.join)),
      run: <A, E, R2>(effect: Effect.Effect<A, E, R2>) =>
        Effect.scopedWith((scope) =>
          effect.pipe(Scope.provide(scope), provide, Effect.catchIf(Predicate.not(S.is(executionError)), Effect.die))
        )
    }
  },
  Effect.provideServiceEffect(Chat.Chat, Chat.empty)
)
