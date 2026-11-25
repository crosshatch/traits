import { Schema as S } from "effect"

import { isNonBlankPattern } from "../util/checks/isNonBlankPattern.ts"

/** One setup instruction for an agent to carry out, in at most 300 characters: what to find or do, not how, and only what the check needs. */
export type TraitPreludeStep = typeof TraitPreludeStep.Type
export const TraitPreludeStep = S.String.check(isNonBlankPattern, S.isMaxLength(300))
  .pipe(S.brand("traits/TraitPreludeStep"))
  .annotate({
    description:
      "One setup instruction for an agent to carry out, in at most 300 characters: what to find or do, not how, and only what the check needs."
  })

export type TraitPreludeSteps = typeof TraitPreludeSteps.Type
export const TraitPreludeSteps = S.NonEmptyArray(TraitPreludeStep).annotate({
  description: "Steps to be carried out by subagents before trait evaluation."
})

export const TraitPrelude = S.Union([TraitPreludeSteps, TraitPreludeStep]).annotate({
  description: "Steps to be carried out by subagents before trait evaluation."
})
