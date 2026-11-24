import { Array, Effect, Order, pipe, Record, Result, Schema as S, String } from "effect"

import * as Input from "../Input/Input.ts"
import { type InputRange, whyInvalidTarget } from "../Input/InputRange.ts"
import type { InputSource } from "../Input/InputSource.ts"
import type { Trait } from "../Trait/Trait.ts"
import { matchesFile } from "../Trait/TraitMatch.ts"
import type { TraitPrelude } from "../Trait/TraitPrelude.ts"
import type { TraitSubject } from "../Trait/TraitSubject.ts"
import type { ResolvedTrait } from "../TraitSelection/ResolvedTrait.ts"
import { TraitReference } from "../TraitSelection/TraitReference.ts"
import type { Probability } from "../util/Probability.ts"
import { ask } from "./Asking.ts"
import * as AssertionQuestion from "./AssertionQuestion.ts"
import * as Evidence from "./Evidence.ts"
import { Outcome } from "./Outcome.ts"
import * as Prelude from "./Prelude.ts"
import type { QuestionId } from "./QuestionId.ts"
import * as SubjectQuestion from "./SubjectQuestion.ts"
import { addUsage, noUsage } from "./Usage.ts"

/** What a check comes to: the trait does not apply to what was checked, its assertion holds, its assertion is violated, or it could not be assessed. */
export type Verdict = typeof Verdict.Type
export const Verdict = S.Literals(["NotApplicable", "Holds", "Violated", "NotAssessed"]).annotate({
  description:
    "What a check comes to: the trait does not apply to what was checked, its assertion holds, its assertion is violated, or it could not be assessed."
})

/** The check of one trait against one file, or against one segment of it. */
export type TraitCheck = typeof TraitCheck.Type
export const TraitCheck = S.Struct({
  /** The trait that was checked. */
  trait: TraitReference.annotateKey({ description: "The trait that was checked." }),
  /** The lines of the file the check covers, counted from 1; omitted when it covers the whole file. */
  lines: S.Struct({
    /** The first line the check covers. */
    start: S.Int.annotateKey({ description: "The first line the check covers." }),
    /** The last line the check covers. */
    end: S.Int.annotateKey({ description: "The last line the check covers." })
  })
    .annotateKey({
      description: "The lines of the file the check covers, counted from 1; omitted when it covers the whole file."
    })
    .pipe(S.optionalKey),
  /** Whether what was checked is or contains an instance of the trait's subject; omitted for a trait with no subject, which applies to everything. */
  applies: Outcome.annotateKey({
    description:
      "Whether what was checked is or contains an instance of the trait's subject; omitted for a trait with no subject, which applies to everything."
  }).pipe(S.optionalKey),
  /** Whether the trait's assertion holds for what was checked; omitted when the trait was not found to apply. */
  holds: Outcome.annotateKey({
    description:
      "Whether the trait's assertion holds for what was checked; omitted when the trait was not found to apply."
  }).pipe(S.optionalKey),
  verdict: Verdict
}).annotate({ description: "The check of one trait against one file, or against one segment of it." })

const isAtLeast = (outcome: Outcome, threshold: Probability) =>
  outcome._tag === "Answered" && outcome.probability >= threshold

/** A question, with the ID it goes by among those remembered about the same evidence. */
interface Identified<Q> {
  readonly id: QuestionId
  readonly question: Q
}

/** A trait that has an assertion to check, with where it stands among the traits being run. */
interface Candidate {
  readonly position: number
  readonly reference: TraitReference
  /** Whether the trait can apply to the file at this path, relative to the workspace root. */
  readonly matchesFile: (path: string) => boolean
  /** Whether what is checked is or contains the trait's subject; none for a trait with no subject, which applies to everything. */
  readonly subject: Identified<TraitSubject> | undefined
  /** Whether the trait's assertion holds for what is checked. */
  readonly assertion: Identified<AssertionQuestion.TraitAssertionWithContext>
  /** The trait, which an agent carrying out its prelude is told about. */
  readonly trait: Trait
  /** Setup for an agent to carry out before the assertion is checked, whose findings the assertion is checked with; none for a trait that needs none. */
  readonly prelude: TraitPrelude | undefined
}

/** What a candidate's prelude found for the file being checked, or why it could not be carried out; carried out once for the file however many of its segments need it. */
type PreludeOf = (candidate: Candidate) => Effect.Effect<Result.Result<Prelude.PreludeFindings, Prelude.PreludeError>>

/** A candidate with whether what was checked matched its subject; a candidate with no subject has nothing to match and applies to everything. */
interface Matched extends Candidate {
  readonly applies: Outcome | undefined
}

/** A check with where its trait stands among the traits being run, which a report lists its checks by. */
interface Positioned {
  readonly position: number
  readonly check: TraitCheck
}

/** The traits that have an assertion to check. A trait with no assertion has nothing to check and is left out. */
export const candidatesOf = Effect.fnUntraced(function* (traits: ReadonlyArray<ResolvedTrait>) {
  const candidates = yield* Effect.forEach(
    traits,
    Effect.fnUntraced(function* ({ reference, trait }, position) {
      const { subject } = trait
      if (trait.assertion === undefined) {
        return []
      }
      const assertion = { assertion: trait.assertion, ...(trait.body === undefined ? {} : { body: trait.body }) }
      const questions = yield* Effect.all(
        {
          subject:
            subject === undefined
              ? Effect.undefined
              : Effect.map(SubjectQuestion.idOf(subject), (id) => ({ id, question: subject })),
          assertion: Effect.map(AssertionQuestion.idOf(assertion), (id) => ({ id, question: assertion }))
        },
        { concurrency: 1 }
      )
      const candidate: Candidate = {
        position,
        reference,
        matchesFile: trait.match === undefined ? () => true : matchesFile(trait.match),
        ...questions,
        trait,
        prelude: trait.prelude
      }
      return [candidate]
    }),
    { concurrency: 1 }
  )
  return Array.flatten(candidates)
})

/** Asks which candidates' subjects the evidence matches. */
const match = Effect.fnUntraced(function* (candidates: ReadonlyArray<Candidate>, evidence: Evidence.Evidence) {
  const withSubject = Array.flatMap(candidates, (candidate) =>
    candidate.subject === undefined ? [] : [{ candidate, subject: candidate.subject }]
  )
  // Traits with the same subject share its question, which is asked once.
  const { outcome, usage } = yield* ask({
    questions: Record.fromEntries(Array.map(withSubject, ({ subject }) => [subject.id, subject.question])),
    key: SubjectQuestion.keyOf(evidence),
    request: (subjects) => SubjectQuestion.match({ subjects, evidence })
  })
  const matched: ReadonlyArray<Matched> = [
    ...pipe(
      candidates,
      Array.filter(({ subject }) => subject === undefined),
      Array.map((candidate) => ({ ...candidate, applies: undefined }))
    ),
    ...Array.map(withSubject, ({ candidate, subject }) => ({ ...candidate, applies: outcome(subject.id) }))
  ]
  return { matched, usage }
})

const applies = (threshold: Probability) => (candidate: Matched) =>
  candidate.applies === undefined || isAtLeast(candidate.applies, threshold)

/** Asks whether the assertions of candidates that apply to the evidence hold for it, and returns a check for each. */
const assert = Effect.fnUntraced(function* (options: {
  readonly applicable: ReadonlyArray<Matched>
  readonly evidence: Evidence.Evidence
  readonly threshold: Probability
}) {
  const { evidence, threshold } = options
  const { outcome, usage } = yield* ask({
    questions: Record.fromEntries(
      Array.map(options.applicable, (candidate) => [candidate.assertion.id, candidate.assertion.question])
    ),
    key: AssertionQuestion.keyOf(evidence),
    request: (assertions) => AssertionQuestion.assert({ assertions, evidence })
  })
  const checks = Array.map(options.applicable, (candidate): Positioned => {
    const holds = outcome(candidate.assertion.id)
    return {
      position: candidate.position,
      check: TraitCheck.make({
        trait: candidate.reference,
        ...(candidate.applies === undefined ? {} : { applies: candidate.applies }),
        holds,
        verdict: holds._tag === "Unanswered" ? "NotAssessed" : isAtLeast(holds, threshold) ? "Holds" : "Violated"
      })
    }
  })
  return { checks, usage }
})

/** The checks of candidates that what was checked was not found to match: not applicable, or not assessed when the model did not say. */
const unmatched = (options: {
  readonly matched: ReadonlyArray<Matched>
  readonly threshold: Probability
}): ReadonlyArray<Positioned> =>
  Array.flatMap(options.matched, (candidate) =>
    candidate.applies === undefined || isAtLeast(candidate.applies, options.threshold)
      ? []
      : [
          {
            position: candidate.position,
            check: TraitCheck.make({
              trait: candidate.reference,
              applies: candidate.applies,
              verdict: candidate.applies._tag === "Unanswered" ? "NotAssessed" : "NotApplicable"
            })
          }
        ]
  )

/** The checks of candidates whose preludes could not be carried out: not assessed, since their assertions need what the preludes find. */
const unprepared = (candidate: Matched, error: Prelude.PreludeError): Positioned => ({
  position: candidate.position,
  check: TraitCheck.make({
    trait: candidate.reference,
    ...(candidate.applies === undefined ? {} : { applies: candidate.applies }),
    holds: { _tag: "Unanswered", reason: "Failed", description: error.message },
    verdict: "NotAssessed"
  })
})

/** Asks whether the assertion of a candidate with a prelude holds, with what the prelude found added to the evidence. Each such candidate is asked about on its own, since what its prelude found is evidence for it alone. */
const assertPrepared = Effect.fnUntraced(function* (options: {
  readonly candidate: Matched
  readonly evidence: Evidence.Evidence
  readonly preludeOf: PreludeOf
  readonly threshold: Probability
}) {
  const { candidate } = options
  const prepared = yield* options.preludeOf(candidate)
  if (Result.isFailure(prepared)) {
    yield* Effect.logWarning(prepared.failure.message)
    return { checks: [unprepared(candidate, prepared.failure)], usage: noUsage }
  }
  return yield* assert({
    applicable: [candidate],
    evidence: Evidence.withPrelude(options.evidence, prepared.success),
    threshold: options.threshold
  })
})

/** Checks one input against candidates: which of their subjects it matches, then whether the assertions of those hold for it. A candidate with a prelude has it carried out first, only once it is found to apply, and its assertion is asked about with what the prelude found. The checks say nothing of where in its file the input is, which is for whoever knows that to add. */
const check = Effect.fnUntraced(function* (options: {
  readonly candidates: ReadonlyArray<Candidate>
  readonly input: Input.Input
  readonly root: URL
  readonly threshold: Probability
  readonly preludeOf: PreludeOf
}) {
  const { threshold } = options
  // Both questions are about the same evidence, and what they are answered is remembered by it.
  const evidence = Evidence.fromInput(options.input, options.root)
  const matches = yield* match(options.candidates, evidence)
  const applicable = Array.filter(matches.matched, applies(threshold))
  const plain = Array.filter(applicable, (candidate) => candidate.prelude === undefined)
  const prepared = Array.filter(applicable, (candidate) => candidate.prelude !== undefined)
  const assessed = yield* assert({ applicable: plain, evidence, threshold })
  const preparedAssessed = yield* Effect.forEach(
    prepared,
    (candidate) => assertPrepared({ candidate, evidence, preludeOf: options.preludeOf, threshold }),
    { concurrency: 1 }
  )
  return {
    checks: [
      ...assessed.checks,
      ...Array.flatMap(preparedAssessed, ({ checks }) => checks),
      ...unmatched({ matched: matches.matched, threshold })
    ],
    usage: Array.reduce(preparedAssessed, addUsage(matches.usage, assessed.usage), (total, { usage }) =>
      addUsage(total, usage)
    )
  }
})

/** Carries out a candidate's prelude for a file, reporting why it could not be rather than failing the check. */
const carryOutPrelude = (candidate: Candidate, file: string) =>
  candidate.prelude === undefined
    ? Effect.succeed(Result.succeed(Prelude.PreludeFindings.make({ found: [], subagents: {} })))
    : Prelude.carryOut({ trait: candidate.trait, prelude: candidate.prelude, file }).pipe(
        Effect.tap(() => Effect.logDebug(`${file}: carried out the prelude of ${candidate.trait.name}.`)),
        Effect.result
      )

/** The path of an input's file relative to the workspace root, as an agent carrying out a prelude is told it. */
const fileOf = (input: Input.Input, root: URL) => Evidence.fromInput(input, root).location

/** The checks in the order of their traits, which is the order a report lists them in. */
const inOrder = (checks: ReadonlyArray<Positioned>): ReadonlyArray<TraitCheck> =>
  pipe(
    checks,
    Array.sortWith(({ position }) => position, Order.Number),
    Array.map((positioned) => positioned.check)
  )

/** Checks one input against traits: first which traits' subjects it matches, then whether the assertions of those traits hold for it. A trait with no subject applies to every input, and a trait with no assertion has nothing to check and is left out. */
export const checkInput = Effect.fn("TraitRun.checkInput")(function* (options: {
  readonly traits: ReadonlyArray<ResolvedTrait>
  readonly input: Input.Input
  /** The URL of the workspace root, which the locations shown to the model are made relative to. */
  readonly root: URL
  /** The probability, from 0 to 1, at or above which a trait applies, and below which its assertion counts as violated. */
  readonly threshold: Probability
}) {
  const candidates = yield* candidatesOf(options.traits)
  const file = fileOf(options.input, options.root)
  const { checks, usage } = yield* check({
    candidates,
    input: options.input,
    root: options.root,
    threshold: options.threshold,
    preludeOf: (candidate) => carryOutPrelude(candidate, file)
  })
  return { checks: inOrder(checks), usage }
})

// A few of a file's segments at a time, as a run takes a few files at a time, keeps the provider's rate limits in reach.
const segmentsAtOnce = 4

/** Checks a file against candidates. A candidate whose match patterns leave the file out is left out without asking the model anything. The rest are checked against each segment on its own: whether it matches the trait's subject, and then whether the trait's assertion holds for it, so each check names the lines it covers. Segments that hold the same text are the same evidence, so the model is asked about one of them for them all. A file with one segment is checked as that one, and its checks name no lines. */
export const checkFile = Effect.fnUntraced(function* (options: {
  readonly candidates: ReadonlyArray<Candidate>
  /** The file's path, relative to the workspace root, which the traits' match patterns are tried against. */
  readonly file: string
  /** The file's location and text. */
  readonly source: InputSource
  /** The ranges of the text to check on their own, in order. */
  readonly segments: ReadonlyArray<InputRange>
  /** The URL of the workspace root, which the locations shown to the model are made relative to. */
  readonly root: URL
  /** The probability at or above which a trait applies, and below which its assertion counts as violated. */
  readonly threshold: Probability
}) {
  const { root, source, threshold } = options
  const candidates = Array.filter(options.candidates, (candidate) => candidate.matchesFile(options.file))
  if (!Array.isReadonlyArrayNonEmpty(candidates)) {
    return { checks: [], usage: noUsage }
  }
  // Ranges that do not select from this text cannot be shown to the model, so the file is then checked as one segment, as is a file with only one.
  const usable = Array.every(options.segments, (range) => whyInvalidTarget(range, source.text) === undefined)
  const divided = usable && options.segments.length > 1
  const lineOf = (offset: number) => pipe(source.text, String.slice(0, offset), String.split("\n")).length
  // A trait with a prelude is checked against the whole file, once: its prelude looks at the file as a whole and beyond it, so a single segment would be judged against findings about the rest of the file.
  const whole = Array.filter(candidates, (candidate) => candidate.prelude !== undefined)
  const segmented = Array.filter(candidates, (candidate) => candidate.prelude === undefined)
  const preludeOf: PreludeOf = (candidate) => carryOutPrelude(candidate, options.file)
  // The whole text is always a valid selection of itself.
  const wholeInput = yield* Effect.orDie(Input.select("after", source, { start: 0, end: source.text.length }))
  const wholeResult = Array.isReadonlyArrayNonEmpty(whole)
    ? yield* check({ candidates: whole, input: wholeInput, root, threshold, preludeOf })
    : undefined
  const wholeChecked =
    wholeResult === undefined
      ? []
      : [
          {
            checks: Array.map(wholeResult.checks, (positioned) => ({ ...positioned, start: 0 })),
            usage: wholeResult.usage
          }
        ]
  // Segments that hold the same text are the same evidence, so they are checked as one.
  const alike = pipe(
    Array.isReadonlyArrayNonEmpty(segmented)
      ? divided
        ? options.segments
        : [{ start: 0, end: source.text.length }]
      : [],
    Array.groupBy((range) => pipe(source.text, String.slice(range.start, range.end))),
    Record.values
  )
  const segmentChecked = yield* Effect.forEach(
    alike,
    Effect.fnUntraced(function* (ranges) {
      // The whole text is always a valid selection of itself, and so is each range once it has been checked against the text.
      const input = yield* Effect.orDie(Input.select("after", source, Array.headNonEmpty(ranges)))
      const { checks, usage } = yield* check({ candidates: segmented, input, root, threshold, preludeOf })
      return {
        // Every one of the segments has the checks, each naming the lines it covers itself.
        checks: Array.flatMap(ranges, (range) => {
          // A file checked as one segment has no lines to tell its checks apart by.
          const lines = divided ? { start: lineOf(range.start), end: lineOf(range.end - 1) } : undefined
          return Array.map(checks, (positioned) => ({
            ...positioned,
            start: range.start,
            check: lines === undefined ? positioned.check : { ...positioned.check, lines }
          }))
        }),
        usage
      }
    }),
    { concurrency: segmentsAtOnce }
  )
  const checked = [...wholeChecked, ...segmentChecked]
  return {
    checks: pipe(
      checked,
      Array.flatMap(({ checks }) => checks),
      // A file's report lists its checks by trait, and under each trait by where the segments start, which ordering by trait keeps.
      Array.sortWith(({ start }) => start, Order.Number),
      inOrder
    ),
    usage: Array.reduce(checked, noUsage, (total, { usage }) => addUsage(total, usage))
  }
})
