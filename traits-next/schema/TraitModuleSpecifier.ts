import { Schema as S } from "effect"

/** A local script or package reference identifying a trait extension module. */
export type TraitModuleSpecifier = typeof TraitModuleSpecifier.Type
export const TraitModuleSpecifier = S.NonEmptyString.check(
  S.isTrimmed(),
  S.isPattern(/^[^\r\n\u2028\u2029]+$/u),
  S.isMaxLength(2_048)
).pipe(S.brand("traits/TraitModuleSpecifier"))
