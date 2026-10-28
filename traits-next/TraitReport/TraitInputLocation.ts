import { Schema as S } from "effect"

export type TraitInputLocation = typeof TraitInputLocation.Type
export const TraitInputLocation = S.Struct({
  /** The path in the referenced snapshot. */
  path: S.NonEmptyString,
  /** The snapshot containing the evaluated material. */
  snapshot: S.Literals(["current", "previous"]),
  /** Zero-based UTF-16 offsets with an exclusive end; omitted for the whole snapshot. */
  range: S.Struct({
    start: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    end: S.Int.check(S.isGreaterThanOrEqualTo(0))
  })
    .check(
      S.makeFilter((range) => range.end >= range.start, {
        message: "Range end must not precede its start."
      })
    )
    .pipe(S.optionalKey)
})
