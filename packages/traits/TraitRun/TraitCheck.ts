import { Array, Effect, Order, pipe, Record, Schema as S, String } from "effect"

import * as Input from "../Input/Input.ts"
import { type InputRange, isValidForText } from "../Input/InputRange.ts"
import type { InputSource } from "../Input/InputSource.ts"
import { matchesFile } from "../Trait/TraitMatch.ts"
import type { TraitSubject } from "../Trait/TraitSubject.ts"
import type { ResolvedTrait } from "../TraitSelection/ResolvedTrait.ts"
import { TraitReference } from "../TraitSelection/TraitReference.ts"
import { hash } from "../util/hash.ts"
import { Probability } from "../util/Probability.ts"
import { ask } from "./Asking.ts"
import * as AssertionQuestion from "./AssertionQuestion.ts"
import * as Evidence from "./Evidence.ts"
import { Outcome } from "./Outcome.ts"
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

const isAtLeast = (outcome: Outcome, threshold: number) =>
  outcome._tag === "Answered" && outcome.probability >= threshold

/** A trait that has an assertion to check, with where it stands among the traits being run. */
interface Candidate {
  readonly position: number
  readonly reference: TraitReference
  readonly subject: TraitSubject | undefined
  /** Whether the trait can apply to the file at this path, relative to the workspace root. */
  readonly matchesFile: (path: string) => boolean
  /** What sets the trait's subject question apart, and its assertion question, among those remembered about the same text. */
  readonly ids: { readonly subject: string; readonly assertion: string }
  readonly assertion: AssertionQuestion.TraitAssertionWithContext
}

/** A candidate with whether what was checked matched its subject; a candidate with no subject has nothing to match and applies to everything. */
interface Matched extends Candidate {
  readonly applies: Outcome | undefined
}

/** A check with what orders it in a file's report: its trait's position, then where its segment starts. */
interface Placed {
  readonly position: number
  readonly start: number
  readonly check: TraitCheck
}

/** The traits that have an assertion to check. A trait with no assertion has nothing to check and is left out. */
export const candidatesOf = Effect.fnUntraced(function* (traits: ReadonlyArray<ResolvedTrait>) {
  const candidates = yield* Effect.forEach(
    traits,
    Effect.fnUntraced(function* ({ reference, trait }, position) {
      if (trait.assertion === undefined) {
        return []
      }
      const assertion = { assertion: trait.assertion, ...(trait.body === undefined ? {} : { body: trait.body }) }
      const ids = yield* Effect.all(
        { subject: hash(trait.subject ?? ""), assertion: hash(assertion) },
        { concurrency: 1 }
      )
      const candidate: Candidate = {
        position,
        reference,
        subject: trait.subject,
        matchesFile: trait.match === undefined ? () => true : matchesFile(trait.match),
        ids,
        assertion
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
  const { outcomes, usage } = yield* ask({
    entries: withSubject,
    id: ({ candidate }) => candidate.ids.subject,
    shared: [SubjectQuestion.prompt, evidence],
    request: (questions) =>
      SubjectQuestion.match({ subjects: Record.map(questions, ({ subject }) => subject), evidence })
  })
  const matched: ReadonlyArray<Matched> = [
    ...pipe(
      candidates,
      Array.filter(({ subject }) => subject === undefined),
      Array.map((candidate) => ({ ...candidate, applies: undefined }))
    ),
    ...Array.zipWith(withSubject, outcomes, ({ candidate }, applies) => ({ ...candidate, applies }))
  ]
  return { matched, usage }
})

const applies = (threshold: number) => (candidate: Matched) =>
  candidate.applies === undefined || isAtLeast(candidate.applies, threshold)

/** Asks whether the assertions of candidates that apply to the evidence hold for it, and returns a check for each. */
const assert = Effect.fnUntraced(function* (options: {
  readonly applicable: ReadonlyArray<Matched>
  readonly evidence: Evidence.Evidence
  /** Where what is checked starts in its file. */
  readonly start: number
  readonly threshold: number
  readonly lines: TraitCheck["lines"]
}) {
  const { evidence, lines, start, threshold } = options
  const { outcomes, usage } = yield* ask({
    entries: options.applicable,
    id: (candidate) => candidate.ids.assertion,
    shared: [AssertionQuestion.prompt, evidence],
    request: (questions) =>
      AssertionQuestion.assert({ assertions: Record.map(questions, ({ assertion }) => assertion), evidence })
  })
  const checks = Array.zipWith(options.applicable, outcomes, (candidate, holds): Placed => ({
    position: candidate.position,
    start,
    check: TraitCheck.make({
      trait: candidate.reference,
      ...(lines === undefined ? {} : { lines }),
      ...(candidate.applies === undefined ? {} : { applies: candidate.applies }),
      holds,
      verdict: holds._tag === "Unanswered" ? "NotAssessed" : isAtLeast(holds, threshold) ? "Holds" : "Violated"
    })
  }))
  return { checks, usage }
})

/** The checks of candidates that what was checked was not found to match: not applicable, or not assessed when the model did not say. */
const unmatched = (options: {
  readonly matched: ReadonlyArray<Matched>
  /** Where what was checked starts in its file. */
  readonly start: number
  readonly threshold: number
  readonly lines: TraitCheck["lines"]
}): ReadonlyArray<Placed> =>
  Array.flatMap(options.matched, (candidate) =>
    candidate.applies === undefined || isAtLeast(candidate.applies, options.threshold)
      ? []
      : [
          {
            position: candidate.position,
            start: options.start,
            check: TraitCheck.make({
              trait: candidate.reference,
              ...(options.lines === undefined ? {} : { lines: options.lines }),
              applies: candidate.applies,
              verdict: candidate.applies._tag === "Unanswered" ? "NotAssessed" : "NotApplicable"
            })
          }
        ]
  )

/** Checks one input against candidates: which of their subjects it matches, then whether the assertions of those hold for it. */
const check = Effect.fnUntraced(function* (options: {
  readonly candidates: ReadonlyArray<Candidate>
  readonly input: Input.Input
  readonly root: URL
  readonly threshold: number
  readonly lines: TraitCheck["lines"]
}) {
  const { input, lines, threshold } = options
  const { start } = input.segment.range
  // Both questions are about the same evidence, and what they are answered is remembered by it.
  const evidence = Evidence.fromInput(input, options.root)
  const matches = yield* match(options.candidates, evidence)
  const assessed = yield* assert({
    applicable: Array.filter(matches.matched, applies(threshold)),
    evidence,
    start,
    threshold,
    lines
  })
  return {
    checks: [...assessed.checks, ...unmatched({ matched: matches.matched, start, threshold, lines })],
    usage: addUsage(matches.usage, assessed.usage)
  }
})

/** The checks in the order a file's report lists them: by trait, and then by where each segment starts. */
const inOrder = (checks: ReadonlyArray<Placed>): ReadonlyArray<TraitCheck> =>
  pipe(
    checks,
    Array.sortWith(({ start }) => start, Order.Number),
    Array.sortWith(({ position }) => position, Order.Number),
    Array.map((placed) => placed.check)
  )

/** Checks one input against traits: first which traits' subjects it matches, then whether the assertions of those traits hold for it. A trait with no subject applies to every input, and a trait with no assertion has nothing to check and is left out. */
export const checkInput = Effect.fn("TraitRun.checkInput")(function* (options: {
  readonly traits: ReadonlyArray<ResolvedTrait>
  readonly input: Input.Input
  /** The URL of the workspace root, which the locations shown to the model are made relative to. */
  readonly root: URL
  /** The probability, from 0 to 1, at or above which a trait applies, and below which its assertion counts as violated. */
  readonly threshold: number
}) {
  const threshold = yield* S.decodeEffect(Probability)(options.threshold)
  const candidates = yield* candidatesOf(options.traits)
  const { checks, usage } = yield* check({
    candidates,
    input: options.input,
    root: options.root,
    threshold,
    lines: undefined
  })
  return { checks: inOrder(checks), usage }
})

// A few of a file's segments at a time, as a run takes a few files at a time, keeps the provider's rate limits in reach.
const segmentsAtOnce = 4

/** Checks a file against candidates. A candidate whose match patterns leave the file out is left out without asking the model anything. The rest are checked against each segment on its own: whether it matches the trait's subject, and then whether the trait's assertion holds for it, so each check names the lines it covers. A file with one segment is checked as that one, and its checks name no lines. */
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
  readonly threshold: number
}) {
  const { root, source, threshold } = options
  const candidates = Array.filter(options.candidates, (candidate) => candidate.matchesFile(options.file))
  if (!Array.isReadonlyArrayNonEmpty(candidates)) {
    return { checks: [], usage: noUsage }
  }
  // Ranges that do not select from this text cannot be shown to the model, so the file is then checked as one segment, as is a file with only one.
  const usable = Array.every(options.segments, (range) => range.end > range.start && isValidForText(range, source.text))
  const divided = usable && options.segments.length > 1
  const lineOf = (offset: number) => pipe(source.text, String.slice(0, offset), String.split("\n")).length
  const checked = yield* Effect.forEach(
    divided ? options.segments : [{ start: 0, end: source.text.length }],
    Effect.fnUntraced(function* (range) {
      // The whole text is always a valid selection of itself, and so is each range once it has been checked against the text.
      const input = yield* Effect.orDie(Input.fromSegment({ after: source }, { _tag: "After", range }))
      return yield* check({
        candidates,
        input,
        root,
        threshold,
        // A file checked as one segment has no lines to tell its checks apart by.
        lines: divided ? { start: lineOf(range.start), end: lineOf(range.end - 1) } : undefined
      })
    }),
    { concurrency: segmentsAtOnce }
  )
  return {
    checks: inOrder(Array.flatMap(checked, ({ checks }) => checks)),
    usage: Array.reduce(checked, noUsage, (total, { usage }) => addUsage(total, usage))
  }
})
