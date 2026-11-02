import { Schema as S } from "effect"

/** A model selected through a saved provider account; capability is validated when resolved. */
export type ModelSelection = typeof ModelSelection.Type
export const ModelSelection = S.Struct({
  account: S.NonEmptyString.check(S.isTrimmed()),
  model: S.NonEmptyString.check(S.isTrimmed())
}).annotate({
  description: "A model selected through a saved provider account; capability is validated when resolved."
})
