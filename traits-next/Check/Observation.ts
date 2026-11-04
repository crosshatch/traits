import { Effect, type Exit, Function } from "effect"

/** Records completion even during interruption before exposing the settled outcome. */
export const capture: {
  <A, E>(
    record: (exit: Exit.Exit<A, E>) => Effect.Effect<void>
  ): <R>(operation: Effect.Effect<A, E, R>) => Effect.Effect<Exit.Exit<A, E>, never, R>
  <A, E, R>(
    operation: Effect.Effect<A, E, R>,
    record: (exit: Exit.Exit<A, E>) => Effect.Effect<void>
  ): Effect.Effect<Exit.Exit<A, E>, never, R>
} = Function.dual(
  2,
  <A, E, R>(operation: Effect.Effect<A, E, R>, record: (exit: Exit.Exit<A, E>) => Effect.Effect<void>) =>
    operation.pipe(Effect.onExit(record), Effect.exit)
)
