import { Array, Effect, Order, pipe, Record, Ref, Schema as S, String } from "effect"

import * as Input from "../Input/Input.ts"
import { type InputRange, whyInvalidTarget } from "../Input/InputRange.ts"
import type { InputSource } from "../Input/InputSource.ts"
import type { Trait } from "../Trait/Trait.ts"
import { matchesFile } from "../Trait/TraitMatch.ts"
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
  /** The trait, whose prelude, when it has one, an agent carries out before its assertion is asked about. */
  readonly trait: Trait
}

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
          assertion: Effect.map(
            AssertionQuestion.idOf({
              ...assertion,
              ...(trait.prelude === undefined ? {} : { prelude: trait.prelude })
            }),
            (id) => ({ id, question: assertion })
          )
        },
        { concurrency: 1 }
      )
      const candidate: Candidate = {
        position,
        reference,
        matchesFile: trait.match === undefined ? () => true : matchesFile(trait.match),
        ...questions,
        trait
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
const assert = Effect.fnUntraced(function* <E extends { readonly _tag: string; readonly message: string }>(options: {
  readonly applicable: ReadonlyArray<Matched>
  readonly evidence: Evidence.Evidence
  readonly threshold: Probability
  /** The evidence the model is shown, when it is more than the evidence the answers are remembered by, got only when something is to be asked; the evidence itself when omitted. */
  readonly shown?: Effect.Effect<Evidence.Evidence, E> | undefined
}) {
  const { evidence, threshold } = options
  const { outcome, usage } = yield* ask({
    questions: Record.fromEntries(
      Array.map(options.applicable, (candidate) => [candidate.assertion.id, candidate.assertion.question])
    ),
    key: AssertionQuestion.keyOf(evidence),
    request: (assertions) =>
      Effect.flatMap(options.shown ?? Effect.succeed(evidence), (shown) =>
        AssertionQuestion.assert({ assertions, evidence: shown })
      )
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

/** Asks whether the assertion of a candidate with a prelude holds, with what the prelude found added to the evidence the model is shown. Each such candidate is asked about on its own, since what its prelude found is evidence for it alone. The answer is remembered by the evidence without what the prelude found, so the prelude is only carried out when it is not already answered: what is checked has changed, or the trait has. A prelude that cannot be carried out leaves the trait not assessed. */
const assertPrepared = Effect.fnUntraced(function* (options: {
  readonly candidate: Matched
  readonly evidence: Evidence.Evidence
  readonly file: string
  readonly threshold: Probability
}) {
  const { candidate, evidence, threshold } = options
  const { prelude } = candidate.trait
  const used = yield* Ref.make(noUsage)
  const assessed = yield* assert({
    applicable: [candidate],
    evidence,
    threshold,
    ...(prelude === undefined
      ? {}
      : {
          shown: Effect.map(
            Prelude.carryOut({ trait: candidate.trait, prelude, file: options.file, usage: used }),
            (found) => Evidence.withPrelude(evidence, found)
          )
        })
  })
  const preludeUsage = yield* Ref.get(used)
  return { checks: assessed.checks, usage: addUsage(assessed.usage, preludeUsage) }
})

/** Checks one input against candidates: which of their subjects it matches, then whether the assertions of those hold for it. A candidate with a prelude has it carried out first, only once it is found to apply, and its assertion is asked about with what the prelude found. The checks say nothing of where in its file the input is, which is for whoever knows that to add. */
const check = Effect.fnUntraced(function* (options: {
  readonly candidates: ReadonlyArray<Candidate>
  readonly input: Input.Input
  readonly root: URL
  readonly threshold: Probability
}) {
  const { threshold } = options
  // Both questions are about the same evidence, and what they are answered is remembered by it.
  const evidence = Evidence.fromInput(options.input, options.root)
  const matches = yield* match(options.candidates, evidence)
  const applicable = Array.filter(matches.matched, applies(threshold))
  const plain = Array.filter(applicable, (candidate) => candidate.trait.prelude === undefined)
  const prepared = Array.filter(applicable, (candidate) => candidate.trait.prelude !== undefined)
  const assessed = yield* assert({ applicable: plain, evidence, threshold })
  const preparedAssessed = yield* Effect.forEach(
    prepared,
    (candidate) => assertPrepared({ candidate, evidence, file: evidence.location, threshold }),
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
  const { checks, usage } = yield* check({
    candidates,
    input: options.input,
    root: options.root,
    threshold: options.threshold
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
  const whole = { start: 0, end: source.text.length }
  const plain = Array.filter(candidates, (candidate) => candidate.trait.prelude === undefined)
  const prepared = Array.filter(candidates, (candidate) => candidate.trait.prelude !== undefined)
  // Segments that hold the same text are the same evidence, so they are checked as one.
  const alike = pipe(
    divided ? options.segments : [whole],
    Array.groupBy((range) => pipe(source.text, String.slice(range.start, range.end))),
    Record.values
  )
  const batches = [
    ...(Array.isReadonlyArrayNonEmpty(plain)
      ? Array.map(alike, (ranges) => ({ candidates: plain, ranges, divided }))
      : []),
    // A trait with a prelude is checked against the whole file, once: its prelude looks at the file as a whole and beyond it, so a single segment would be judged against findings about the rest of the file.
    ...(Array.isReadonlyArrayNonEmpty(prepared)
      ? [{ candidates: prepared, ranges: Array.of(whole), divided: false }]
      : [])
  ]
  const checked = yield* Effect.forEach(
    batches,
    Effect.fnUntraced(function* (batch) {
      // The whole text is always a valid selection of itself, and so is each range once it has been checked against the text.
      const input = yield* Effect.orDie(Input.select("after", source, Array.headNonEmpty(batch.ranges)))
      const { checks, usage } = yield* check({ candidates: batch.candidates, input, root, threshold })
      return {
        // Every one of the segments has the checks, each naming the lines it covers itself.
        checks: Array.flatMap(batch.ranges, (range) => {
          // A file checked as one segment has no lines to tell its checks apart by.
          const lines = batch.divided ? { start: lineOf(range.start), end: lineOf(range.end - 1) } : undefined
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
