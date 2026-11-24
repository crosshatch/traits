import { Schema as S } from "effect"

import { TraitAssertion } from "./TraitAssertion.ts"
import { TraitBody } from "./TraitBody.ts"
import { TraitMatch } from "./TraitMatch.ts"
import { TraitName } from "./TraitName.ts"
import { TraitPrelude } from "./TraitPrelude.ts"
import { TraitPurpose } from "./TraitPurpose.ts"
import { TraitSubject } from "./TraitSubject.ts"

export * from "./TraitAssertion.ts"
export * from "./TraitBody.ts"
export * from "./TraitMatch.ts"
export * from "./TraitName.ts"
export * from "./TraitPrelude.ts"
export * from "./TraitPurpose.ts"
export * from "./TraitSubject.ts"

/** A static trait definition with optional subject, match, assertion, prelude, and supporting body. */
export type Trait = typeof Trait.Type
export const Trait = S.Struct({
  /** A descriptive kebab-case trait name without a redundant trait- prefix. */
  name: TraitName,
  /** The kind of artifact, action, transaction, relationship, or situation to identify and assess. */
  subject: TraitSubject.pipe(S.optionalKey),
  /** The files the trait can apply to, as one glob pattern or a list of them; every file when omitted. A file that none of them matches is not checked against the trait at all, which costs nothing, where the subject is judged by a model. */
  match: TraitMatch.annotateKey({
    description:
      "The files the trait can apply to, as one glob pattern or a list of them; every file when omitted. A file that none of them matches is not checked against the trait at all, which costs nothing, where the subject is judged by a model."
  }).pipe(S.optionalKey),
  /** The assertion to assess; omitted for guidance-only traits that produce no assertion assessment. */
  assertion: TraitAssertion.annotateKey({
    description: "The assertion to assess; omitted for guidance-only traits that produce no assertion assessment."
  }).pipe(S.optionalKey),
  /** What the trait aims to achieve or protect, and why that matters. */
  purpose: TraitPurpose,
  /** Setup for an agent to carry out before the trait is checked, to gather supporting data or trigger side effects; omitted when the trait needs none. */
  prelude: TraitPrelude.annotateKey({
    description:
      "Setup for an agent to carry out before the trait is checked, to gather supporting data or trigger side effects; omitted when the trait needs none."
  }).pipe(S.optionalKey),
  /** Supporting context from the trait's Markdown body, such as examples, not hidden requirements. */
  body: TraitBody.annotateKey({
    description: "Supporting context from the trait's Markdown body, such as examples, not hidden requirements."
  }).pipe(S.optionalKey)
}).annotate({
  description: "A static trait definition with optional subject, match, assertion, prelude, and supporting body."
})
