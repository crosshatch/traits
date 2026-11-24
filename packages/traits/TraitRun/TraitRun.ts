import { Array, Effect, Option, pipe, Result, Schema as S, String } from "effect"

import type { InputRange } from "../Input/InputRange.ts"
import type { InputSource } from "../Input/InputSource.ts"
import type { StorageError } from "../StorageError.ts"
import * as ResolvedTrait from "../TraitSelection/ResolvedTrait.ts"
import type { TraitSelectionId } from "../TraitSelection/TraitSelectionId.ts"
import { Probability } from "../util/Probability.ts"
import * as Budget from "./Budget.ts"
import { FileReport, Report } from "./Report.ts"
import { candidatesOf, checkFile } from "./TraitCheck.ts"
import { addUsage, noUsage } from "./Usage.ts"

export type { Budget } from "./Budget.ts"
export * from "./Outcome.ts"
export * from "./Report.ts"
export { checkInput, TraitCheck, Verdict } from "./TraitCheck.ts"
export { addUsage, noUsage, Usage } from "./Usage.ts"

/** The files a run checks. They are listed and read by each run, not handed over already loaded, so a run sees them as they are when it reaches them. Hosts supply where they come from. */
export interface Files {
  /** The URL of the workspace root, which the locations shown to the model are made relative to. */
  readonly root: URL
  /** The paths of the files to check, relative to the workspace root, in order. */
  readonly paths: Effect.Effect<ReadonlyArray<string>, StorageError>
  /** The file's location and current text, or none when it holds no text to check, such as a binary file or one that no longer exists. */
  readonly read: (path: string) => Effect.Effect<Option.Option<InputSource>, StorageError>
}

/** How a run's files are divided into the segments that are checked on their own: given a file's path, relative to the workspace root, and its text, the ranges of the text, in ascending order without overlap. A file that is not divided has one range, its whole text. */
export type Segmentation = (file: string, text: string) => ReadonlyArray<InputRange>

const whole: Segmentation = (_, text) => [{ start: 0, end: text.length }]

// A few files at a time, each a few of its segments at a time, keeps the provider's rate limits in reach.
const filesAtOnce = 4

/** Runs traits against every one of the files: the traits the selections refer to, or those of the selection with the ID default when none is named. The files are listed and read as the run goes, and each is divided into segments as the segmentation says. What the model leaves unanswered is recorded in the report rather than failing the run. */
export const run = Effect.fn("TraitRun.run")(function* <R = never>(options: {
  readonly files: Files
  /** How the files are divided into the segments that are checked on their own, got ready anew by each run so that it goes by the rules and the files as they are then. Every file is checked whole when omitted. */
  readonly segmentation?: Effect.Effect<Segmentation, StorageError, R> | undefined
  readonly selections: ReadonlyArray<TraitSelectionId>
  /** The probability, from 0 to 1, at or above which a trait applies to what is checked, and below which its assertion counts as violated. */
  readonly threshold: number
  /** The most the run may use; no limit when omitted. A request is only made while what it is expected to use still fits, so what does not fit is left unanswered, and a later run picks up from the answers this one was given. */
  readonly budget?: Budget.Budget | undefined
}) {
  const { files } = options
  // Turned away before anything is asked, where it would otherwise only be found out when the report is made.
  const threshold = yield* S.decodeEffect(Probability)(options.threshold)
  const segment = options.segmentation === undefined ? whole : yield* options.segmentation
  const spending = options.budget === undefined ? undefined : yield* Budget.spendingOf(options.budget)
  const traits = yield* ResolvedTrait.fromSelections(options.selections)
  // Worked out once for the run, since every file is checked against the same traits.
  const candidates = yield* candidatesOf(traits)
  const paths = yield* files.paths
  const results = yield* Effect.forEach(
    paths,
    Effect.fnUntraced(function* (file) {
      const source = yield* files.read(file)
      if (Option.isNone(source) || String.isEmpty(String.trim(source.value.text))) {
        return Result.fail(file)
      }
      const segments = segment(file, source.value.text)
      yield* Effect.logDebug(`${file}: ${segments.length} segment(s) to check.`)
      const { checks, usage } = yield* checkFile({
        candidates,
        file,
        source: source.value,
        segments,
        root: files.root,
        threshold
      })
      return Result.succeed({ report: FileReport.make({ file, checks }), usage })
    }),
    { concurrency: filesAtOnce }
  ).pipe(Effect.provideService(Budget.CurrentSpending, spending))
  const [checked, skipped] = Array.partition(results, (result) => result)
  return Report.make({
    threshold,
    traits: pipe(
      traits,
      Array.filter(({ trait }) => trait.assertion !== undefined),
      Array.map(({ reference }) => reference)
    ),
    files: Array.map(checked, ({ report }) => report),
    skipped,
    usage: Array.reduce(checked, noUsage, (total, { usage }) => addUsage(total, usage))
  })
})
