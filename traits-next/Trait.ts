import { Schema as S } from "effect"

import { TraitModuleSpecifier, TraitModuleSpecifiers } from "./schema/index.ts"
import { TraitAssertion } from "./TraitAssertion.ts"
import { TraitBody } from "./TraitBody.ts"
import { TraitName } from "./TraitName.ts"
import { TraitPurpose } from "./TraitPurpose.ts"
import { TraitSubject } from "./TraitSubject.ts"

/** A trait's static definition, required segmenter, and optional enrichment references. */
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
  /** The segmenter to use for evaluation. */
  segment: TraitModuleSpecifier,
  /** Modules supplying input-specific evaluation context. */
  enrichments: TraitModuleSpecifiers.pipe(S.optionalKey),
  /** Shared supporting context from the trait's Markdown body. */
  body: TraitBody.pipe(S.optionalKey)
})
