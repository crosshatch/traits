import { Data, Schema as S } from "effect"

import type { TraitDocument } from "./TraitFile.ts"
import { TraitName } from "./TraitName.ts"

const Reason = S.String.annotate({
  description:
    "Why the existing trait relates to the proposal as it does, citing their specific rules, for the agent and user reconciling them."
})
const BlockingRelationship = S.Literals(["conflict", "inconclusive", "clarification"]).annotate({
  description:
    "conflict: following one would violate the other; inconclusive: too ambiguous to tell; clarification: one of several traits the proposal could replace."
})

/** Explained outcomes which require no approval or persistence; shared by plans and completed derivations. */
export type BlockedDerivation = typeof BlockedDerivation.Type
export const BlockedDerivation = S.TaggedUnion({
  Covered: {
    name: TraitName,
    by: S.NonEmptyArray(S.Struct({ name: TraitName, reason: Reason })).annotate({
      description: "The existing traits that cover the proposal, and why each does."
    })
  },
  Unresolved: {
    name: TraitName,
    traits: S.NonEmptyArray(S.Struct({ name: TraitName, relationship: BlockingRelationship, reason: Reason })).annotate(
      {
        description: "The existing traits blocking the proposal, how each relates to it, and why."
      }
    )
  },
  NameTaken: { name: TraitName }
})

/** A complete proposed write with its current snapshot, or an explained no-write outcome. */
export type TraitDerivationPlan = Data.TaggedEnum<{
  readonly Blocked: {
    readonly reason: BlockedDerivation
  }
  readonly Proposed: {
    readonly document: TraitDocument
    readonly text: string
    readonly current: string | undefined
    readonly relationship: "covered" | "clarification" | undefined
    readonly reason: string | undefined
  }
}>
export const TraitDerivationPlan = Data.taggedEnum<TraitDerivationPlan>()
