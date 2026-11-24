import { Array, Predicate, Record, Schema as S } from "effect"

import { isKebabCasePattern } from "../util/checks/isKebabCasePattern.ts"
import { isNonBlankPattern } from "../util/checks/isNonBlankPattern.ts"

/** One setup instruction for an agent to carry out, in at most 300 characters: what to find or do, not how, and only what the check needs. */
export type TraitPreludeStep = typeof TraitPreludeStep.Type
export const TraitPreludeStep = S.String.check(isNonBlankPattern, S.isMaxLength(300))
  .pipe(S.brand("traits/TraitPreludeStep"))
  .annotate({
    description:
      "One setup instruction for an agent to carry out, in at most 300 characters: what to find or do, not how, and only what the check needs."
  })

/** The kebab-case label of a subagent's steps, starting with a letter, such as entry-points; what the subagent finds is handed back under it. */
export type TraitPreludeLabel = typeof TraitPreludeLabel.Type
export const TraitPreludeLabel = S.String.check(isKebabCasePattern, S.isMaxLength(100)).annotate({
  description:
    "The kebab-case label of a subagent's steps, starting with a letter, such as entry-points; what the subagent finds is handed back under it."
})

/** Steps to carry out one after another, in the order given. A step is an instruction, or a group of subagents to run before the next step. */
export type TraitPreludeSteps = Array.NonEmptyReadonlyArray<TraitPreludeStep | TraitPreludeSubagents>

/** Subagents that can run at the same time, each with its own steps under its own label. */
export interface TraitPreludeSubagents {
  readonly [label: TraitPreludeLabel]: TraitPreludeSteps
}

/** Setup for an agent to carry out before the trait is checked, to gather supporting data or trigger side effects: either steps to carry out in order, or subagents to run at the same time. What it finds is handed to the check. */
export type TraitPrelude = TraitPreludeSteps | TraitPreludeSubagents

/** A prelude as it is written, before its steps are validated. */
export type TraitPreludeEncoded = TraitPreludeStepsEncoded | TraitPreludeSubagentsEncoded
type TraitPreludeStepsEncoded = Array.NonEmptyReadonlyArray<string | TraitPreludeSubagentsEncoded>
interface TraitPreludeSubagentsEncoded {
  readonly [label: string]: TraitPreludeStepsEncoded
}

// Schemas that refer to each other cannot have their types inferred, so they are stated.
const Steps: S.Codec<TraitPreludeSteps, TraitPreludeStepsEncoded> = S.NonEmptyArray(
  S.Union([TraitPreludeStep, S.suspend(() => Subagents)])
).annotate({
  identifier: "TraitPreludeSteps",
  description:
    "Steps to carry out one after another, in the order given. A step is an instruction, or a group of subagents to run before the next step."
})

const Subagents: S.Codec<TraitPreludeSubagents, TraitPreludeSubagentsEncoded> = S.Record(S.String, Steps)
  // Labels are checked rather than used as the key schema, so a label that is not valid is rejected even where unknown keys are dropped.
  .check(S.isMinProperties(1), S.isPropertyNames(TraitPreludeLabel))
  .annotate({
    identifier: "TraitPreludeSubagents",
    description: "Subagents that can run at the same time, each with its own steps under its own label."
  })

/** Whether a prelude is steps to carry out in order, rather than subagents to run at the same time. */
export const isSteps = (prelude: TraitPrelude): prelude is TraitPreludeSteps => Array.isArray(prelude)

/** Every label in a prelude, at any depth. */
const labels = (prelude: TraitPrelude): ReadonlyArray<TraitPreludeLabel> =>
  isSteps(prelude)
    ? Array.flatMap(prelude, (step) => (Predicate.isString(step) ? [] : labels(step)))
    : Array.flatMap(Record.toEntries(prelude), ([label, steps]) => [label, ...labels(steps)])

export const TraitPrelude: S.Codec<TraitPrelude, TraitPreludeEncoded> = S.Union([Steps, Subagents])
  .annotate({
    description:
      "Setup for an agent to carry out before the trait is checked, to gather supporting data or trigger side effects: either steps to carry out in order, or subagents to run at the same time. What it finds is handed to the check."
  })
  .check(
    S.makeFilter((prelude) => {
      const all = labels(prelude)
      const repeated = Array.dedupe(Array.filter(all, (label, index) => all.indexOf(label) !== index))
      // What each subagent finds is handed back under its label, so a label names one subagent in the whole prelude.
      return Array.map(repeated, (label) => ({
        path: [],
        issue: `The label ${label} is used for more than one subagent.`
      }))
    })
  )
