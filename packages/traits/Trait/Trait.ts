import { Schema as S } from "effect"

import { TraitAssertion } from "./TraitAssertion.ts"
import { TraitBody } from "./TraitBody.ts"
import { TraitName } from "./TraitName.ts"
import { TraitPurpose } from "./TraitPurpose.ts"
import { TraitSubject } from "./TraitSubject.ts"

export * from "./TraitAssertion.ts"
export * from "./TraitBody.ts"
export * from "./TraitName.ts"
export * from "./TraitPurpose.ts"
export * from "./TraitSubject.ts"

/** A static trait definition with optional subject, assertion, and supporting body. */
export type Trait = typeof Trait.Type
export const Trait = S.Struct({
  /** A descriptive kebab-case trait name without a redundant trait- prefix. */
  name: TraitName,
  /** The kind of artifact, action, transaction, relationship, or situation to identify and assess. */
  subject: TraitSubject.pipe(S.optionalKey),
  /** The assertion to assess; omitted for guidance-only traits that produce no assertion assessment. */
  assertion: TraitAssertion.annotateKey({
    description: "The assertion to assess; omitted for guidance-only traits that produce no assertion assessment."
  }).pipe(S.optionalKey),
  /** What the trait aims to achieve or protect, and why that matters. */
  purpose: TraitPurpose,
  /** Supporting context from the trait's Markdown body, such as examples, not hidden requirements. */
  body: TraitBody.annotateKey({
    description: "Supporting context from the trait's Markdown body, such as examples, not hidden requirements."
  }).pipe(S.optionalKey)
}).annotate({
  description: "A static trait definition with optional subject, assertion, and supporting body."
})
