import { Schema as S } from "effect"

export const labelRequest = S.Struct({
  labels: S.Array(S.String.check(S.isMinLength(1)))
})
