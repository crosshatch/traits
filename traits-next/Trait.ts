import { Schema as S } from "effect"

import { ModuleSpecifier, ModuleSpecifiers } from "./schema/index.ts"
import { TraitAssertion } from "./TraitAssertion.ts"
import { TraitBody } from "./TraitBody.ts"
import { TraitName } from "./TraitName.ts"
import { TraitPurpose } from "./TraitPurpose.ts"
import { TraitSubject } from "./TraitSubject.ts"

/** A static trait definition with required segmentation and optional assertion, supporting body, and enrichments. */
export type Trait = typeof Trait.Type
export const Trait = S.Struct({
  /** A descriptive kebab-case trait name without a redundant trait- prefix. */
  name: TraitName,
  /** The kind of artifact, action, transaction, relationship, or situation to identify and assess. */
  subject: TraitSubject,
  /** The assertion to assess; omitted for guidance-only traits that produce no assertion assessment. */
  assertion: TraitAssertion.annotate({
    description: "The assertion to assess; omitted for guidance-only traits that produce no assertion assessment."
  }).pipe(S.optionalKey),
  /** What the trait aims to achieve or protect, and why that matters. */
  purpose: TraitPurpose,
  /** The required module selecting assessment segments from each change. */
  segment: ModuleSpecifier.annotate({
    description: "The required module selecting assessment segments from each change."
  }),
  /** Ordered, distinct modules supplying input-specific context; omitted when no enrichments are configured. */
  enrichments: ModuleSpecifiers.annotate({
    description:
      "Ordered, distinct modules supplying input-specific context; omitted when no enrichments are configured."
  }).pipe(S.optionalKey),
  /** Shared supporting context from the trait's Markdown body; enrichments do not modify it. */
  body: TraitBody.annotate({
    description: "Shared supporting context from the trait's Markdown body; enrichments do not modify it."
  }).pipe(S.optionalKey)
}).annotate({
  description:
    "A static trait definition with required segmentation and optional assertion, supporting body, and enrichments."
})
