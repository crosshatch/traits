import { Array, pipe, Schema as S } from "effect"

import { TraitReference } from "../TraitSelection/TraitReference.ts"
import { Probability } from "../util/Probability.ts"
import { TraitCheck, type Verdict } from "./TraitCheck.ts"
import { Usage } from "./Usage.ts"

/** Every trait's check against one file. */
export type FileReport = typeof FileReport.Type
export const FileReport = S.Struct({
  /** The file's path, relative to the workspace root. */
  file: S.String.annotateKey({ description: "The file's path, relative to the workspace root." }),
  /** The check of each trait against each segment of the file, in the order the traits were run and then of the segments. A trait whose match patterns leave the file out is left out. */
  checks: S.Array(TraitCheck).annotateKey({
    description:
      "The check of each trait against each segment of the file, in the order the traits were run and then of the segments. A trait whose match patterns leave the file out is left out."
  })
}).annotate({ description: "Every trait's check against one file." })

/** What a run found: each file's checks, the files that were skipped, and what it cost. */
export type Report = typeof Report.Type
export const Report = S.Struct({
  /** The probability at or above which a trait applies to what is checked, and below which its assertion counts as violated. */
  threshold: Probability.annotateKey({
    description:
      "The probability at or above which a trait applies to what is checked, and below which its assertion counts as violated."
  }),
  /** The traits that were run, in order. A trait with no assertion has nothing to check and is left out. */
  traits: S.Array(TraitReference).annotateKey({
    description: "The traits that were run, in order. A trait with no assertion has nothing to check and is left out."
  }),
  /** The files that were checked, in order. */
  files: S.Array(FileReport).annotateKey({ description: "The files that were checked, in order." }),
  /** The files that were not checked because they hold no text, such as binary and empty files. */
  skipped: S.Array(S.String).annotateKey({
    description: "The files that were not checked because they hold no text, such as binary and empty files."
  }),
  usage: Usage
}).annotate({ description: "What a run found: each file's checks, the files that were skipped, and what it cost." })

/** How many checks in a report came to each verdict. */
export const tally = (report: {
  readonly files: ReadonlyArray<{ readonly checks: ReadonlyArray<{ readonly verdict: Verdict }> }>
}): Readonly<Record<Verdict, number>> =>
  pipe(
    report.files,
    Array.flatMap(({ checks }) => checks),
    Array.reduce({ NotApplicable: 0, Holds: 0, Violated: 0, NotAssessed: 0 }, (counts, { verdict }) => ({
      ...counts,
      [verdict]: counts[verdict] + 1
    }))
  )

/** An amount in US dollars, to three figures, since what a run costs is often a fraction of a cent. */
const dollars = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumSignificantDigits: 3 }).format(value)

/** The checks that need attention, by file, then the totals. */
export const format = (report: typeof Report.Encoded): string => {
  const counts = tally(report)
  const files = Array.flatMap(report.files, ({ checks, file }) => {
    const lines = Array.flatMap(checks, ({ applies, holds, lines, trait, verdict }) => {
      const where =
        lines === undefined
          ? ""
          : lines.start === lines.end
            ? `, line ${lines.start}`
            : `, lines ${lines.start}-${lines.end}`
      if (verdict === "Violated" && holds?._tag === "Answered") {
        return [`  violated      ${trait}${where} (${holds.probability.toFixed(2)})`]
      }
      const unanswered = holds?._tag === "Unanswered" ? holds : applies?._tag === "Unanswered" ? applies : undefined
      // What the budget left unasked is counted in the totals, since it can be most of a run and each says the same.
      return verdict === "NotAssessed" && unanswered !== undefined && unanswered.reason !== "OverBudget"
        ? [`  not assessed  ${trait}${where}: ${unanswered.reason}, ${unanswered.description}`]
        : []
    })
    return Array.isReadonlyArrayNonEmpty(lines) ? [Array.join([file, ...lines], "\n")] : []
  })
  const unasked = pipe(
    report.files,
    Array.flatMap(({ checks }) => checks),
    Array.filter(({ applies, holds }) => {
      const last = holds ?? applies
      return last?._tag === "Unanswered" && last.reason === "OverBudget"
    })
  ).length
  const totals = Array.join(
    [
      `Files checked: ${report.files.length}, against ${report.traits.length} traits at a threshold of ${report.threshold}.`,
      `Checks: ${counts.Violated} violated, ${counts.NotAssessed} not assessed, ${counts.Holds} held, ${counts.NotApplicable} did not apply.`,
      ...(Array.isReadonlyArrayNonEmpty(report.skipped)
        ? [`Files skipped for holding no text: ${report.skipped.length}.`]
        : []),
      ...(unasked > 0
        ? [`Checks not asked, the run having reached its budget: ${unasked}. Run again to carry on from here.`]
        : []),
      `Requests: ${report.usage.requests}. Tokens: ${report.usage.inputTokens} in, ${report.usage.outputTokens} out.${report.usage.cost === undefined ? "" : ` Cost: ${dollars(report.usage.cost)}.`} Answers remembered from earlier runs: ${report.usage.remembered}.`
    ],
    "\n"
  )
  return Array.join([...files, totals], "\n\n")
}
