import { Schema as S } from "effect"

import { TraitAssertion } from "./TraitAssertion.ts"
import { TraitBody } from "./TraitBody.ts"
import { TraitEnrichmentModules } from "./TraitEnrichment/index.ts"
import { TraitName } from "./TraitName.ts"
import { TraitPurpose } from "./TraitPurpose.ts"
import { TraitSubject } from "./TraitSubject.ts"

/** A trait's static definition and optional enrichment module references. */
export type Trait = typeof Trait.Type
export const Trait = S.Struct({
  name: TraitName,
  subject: TraitSubject,
  assertion: TraitAssertion.pipe(S.optionalKey),
  purpose: TraitPurpose,
  enrichments: TraitEnrichmentModules.pipe(S.optionalKey),
  body: TraitBody.pipe(S.optionalKey)
})
