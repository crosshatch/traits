import { Effect, pipe, Predicate, Schema as S } from "effect"

import type { ExtensionServices } from "./ExtensionServices.ts"
import type { ModuleSpecifier } from "./util/index.ts"

/** A module whose default export initializes a trait extension. */
export const ExtensionModule = <A, E>() =>
  S.Struct({
    default: S.declare((value): value is Effect.Effect<A, E, ExtensionServices> => Effect.isEffect(value))
  }).annotate({
    description: "A module whose default export is an Effect that initializes a trait extension."
  })

/** Loads and initializes an extension, preserving validation errors and declared setup failures. */
export const load = Effect.fnUntraced(function* <A, E>(
  module: ModuleSpecifier,
  result: S.ConstraintDecoder<A>,
  error: S.Constraint & { readonly Type: E }
) {
  const imported = yield* Effect.promise(() => import(module))
  const extension = yield* pipe(imported, S.decodeUnknownEffect(ExtensionModule<A, E>()))
  const execute = yield* extension.default.pipe(
    Effect.catchIf(Predicate.not(Predicate.or(S.is(error), S.isSchemaError)), Effect.die)
  )
  return yield* pipe(execute, S.decodeUnknownEffect(result))
})
