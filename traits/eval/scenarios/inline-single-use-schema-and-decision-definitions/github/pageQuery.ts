import { Schema as S } from "effect"

export const pageQuery = S.Struct({
  page: S.Int.check(S.isGreaterThanOrEqualTo(1)),
  per_page: S.Int.check(S.isBetween({ minimum: 1, maximum: 100 }))
})
