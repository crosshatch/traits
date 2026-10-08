import { Schema as S } from "effect"

export type TraitId = typeof TraitId.Type
export const TraitId = S.String.pipe(S.brand("traits/Trait"))

export type Trait = typeof Trait.Type
export const Trait = S.Struct({ id: TraitId, body: S.String })
