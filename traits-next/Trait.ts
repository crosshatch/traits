import { Schema as S } from "effect"

import { TraitAssertion } from "./TraitAssertion.ts"
import { TraitBody } from "./TraitBody.ts"
import { TraitEnrichmentModules } from "./TraitEnrichment/index.ts"
import { TraitName } from "./TraitName.ts"
import { TraitPurpose } from "./TraitPurpose.ts"
import { TraitSegmenterModule } from "./TraitSegmenter/index.ts"
import { TraitSubject } from "./TraitSubject.ts"

/** A trait's static definition and optional segmenter and enrichment references. */
export type Trait = typeof Trait.Type
export const Trait = S.Struct({
  /** The trait's descriptive kebab-case name. */
  name: TraitName,
  /** The kind of material or situation the trait applies to. */
  subject: TraitSubject,
  /** The assertion to assess; omitted for guidance-only traits. */
  assertion: TraitAssertion.pipe(S.optionalKey),
  /** What the trait aims to achieve or protect, and why. */
  purpose: TraitPurpose,
  /** The segmenter to use; omitted for whole-input evaluation. */
  segment: TraitSegmenterModule.pipe(S.optionalKey),
  /** Modules supplying input-specific evaluation context. */
  enrichments: TraitEnrichmentModules.pipe(S.optionalKey),
  /** Shared supporting context from the trait's Markdown body. */
  body: TraitBody.pipe(S.optionalKey)
})
