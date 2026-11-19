import { Array, Function, String } from "effect"

import { DecisionPolicy } from "../../../DecisionPolicy.ts"
import type { Explanation } from "../../../Report/Explanation.ts"
import { type Report, verdicts } from "../../../Report/Report.ts"

const explain = (value: Explanation) => (value._tag === "Error" ? value.error : value.instruction)

/** Formats source-free results with explicit display thresholds and actionable target details. */
export const format: {
  (report: Report, policy?: DecisionPolicy): string
  (policy: DecisionPolicy | undefined): (report: Report) => string
} = Function.dual(
  (args) => args.length > 1 || (args[0] !== undefined && "version" in args[0]),
  (report: Report, policy?: DecisionPolicy): string => {
    const applied = policy ?? DecisionPolicy.make({ fail: 0.5, pass: 0.5 })
    const results = verdicts(report, applied)
    const counts = { Pass: 0, Fail: 0, Inconclusive: 0, Incomplete: 0 }
    const lines = [
      `Traits check: ${results.verdict}`,
      `Policy: fail >= ${applied.fail}, pass + not applicable >= ${applied.pass}${policy === undefined ? " (display only; no exit policy configured)" : ""}`
    ]
    Array.forEach(report.traits, (trait, t) => {
      const result = results.traits[t]!
      counts[result.verdict]++
      lines.push(`\n${result.verdict} ${trait.trait.name}`)
      Array.forEach(trait.changes, (change, c) => {
        const outcome = result.changes[c]!
        const source = report.changes[c]!
        const filename = source.after?.path ?? source.before?.path
        if (change._tag === "NotSegmented") {
          lines.push(`  Incomplete ${filename}: segmentation unavailable`)
          return
        }
        Array.forEach(change.inputs, (input, i) => {
          const verdict = outcome.inputs[i]!
          if (verdict === "Pass") {
            return
          }
          const path = input.segment._tag === "Before" ? source.before?.path : source.after?.path
          const { start, end } = input.segment.range
          lines.push(
            `  ${verdict} ${path ?? filename} (${String.toLowerCase(input.segment._tag)}, offsets ${start}-${end})`
          )
          if (input._tag === "Completed" && input.assessment !== undefined) {
            const a = input.assessment
            lines.push(
              `    pass=${a.pass.toFixed(3)} fail=${a.fail.toFixed(3)} not applicable=${a.na.toFixed(3)} uncertain=${a.uncertain.toFixed(3)}`
            )
            if (trait.trait.assertion !== undefined) {
              lines.push(`    Assertion: ${trait.trait.assertion}`)
            }
          }
          if (input._tag === "Failed" && input.explanation !== undefined) {
            lines.push(`    ${explain(input.explanation)}`)
          }
          if (input._tag === "Cancelled") {
            lines.push("    Assessment cancelled")
          }
          if (input._tag !== "Unmatched") {
            for (const enrichment of input.enrichments) {
              if (enrichment._tag === "Failed") {
                lines.push(`    ${enrichment.module}: ${explain(enrichment.explanation)}`)
              } else if (enrichment._tag !== "Succeeded") {
                lines.push(`    ${enrichment.module}: ${enrichment._tag}`)
              }
            }
          }
        })
      })
    })
    for (const diagnostic of report.diagnostics)
      lines.push(`\nIncomplete ${diagnostic.origin._tag}: ${explain(diagnostic.explanation)}`)
    lines.push(
      `\nTraits: ${counts.Pass} passed, ${counts.Fail} failed, ${counts.Inconclusive} inconclusive, ${counts.Incomplete} incomplete`
    )
    lines.push(`Files: ${report.changes.length}; diagnostics: ${report.diagnostics.length}`)
    if (report.traits.length === 0) {
      lines.push("No traits selected; no trait assessments performed.")
    }
    return Array.join(lines, "\n")
  }
)
