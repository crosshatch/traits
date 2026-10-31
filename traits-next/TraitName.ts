import { Schema as S } from "effect"

/** A descriptive kebab-case trait name without a redundant trait- prefix. */
export type TraitName = typeof TraitName.Type
export const TraitName = S.NonEmptyString.check(
  S.isTrimmed(),
  S.isPattern(/^(?!trait-)[a-z0-9]+(?:-[a-z0-9]+)*$/),
  S.isMaxLength(200)
)
  .pipe(S.brand("traits/TraitName"))
  .annotate({
    description: "A descriptive kebab-case trait name without a redundant trait- prefix."
  })
