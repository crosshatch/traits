import { Array, Console, Effect, Option, pipe } from "effect"

import type { Segmentation } from "../../TraitRun/TraitRun.ts"
import { matchesGlob } from "../../util/matchesGlob.ts"
import type { SegmentationRule } from "./SegmentationRule.ts"
import * as TypeScriptSegmentation from "./segmenters/typescript.ts"

export * from "./SegmentationRule.ts"

/** The rules for files that none of the given rules matches. A file these do not match either is kept whole. */
const builtIn: ReadonlyArray<SegmentationRule> = [{ files: "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}", by: "typescript" }]

/** Gets ready to divide a project's files for one run, and returns what divides them: by the given rules, such as those under segmentation in traits/config.json, the first whose pattern matches a file deciding, and then by the built-in rules. The parser is loaded each time. */
export const prepare = Effect.fn("Segmentation.prepare")(function* (rules: ReadonlyArray<SegmentationRule>) {
  const ordered = Array.map(Array.appendAll(rules, builtIn), (rule) => ({
    by: rule.by,
    matches: matchesGlob(rule.files)
  }))
  const typescript = yield* TypeScriptSegmentation.load.pipe(
    // Without the parser the run still checks every file, only without dividing these.
    Effect.tapError((error) =>
      Console.error(`${error.message} JavaScript and TypeScript files are checked whole. Cause: ${String(error.cause)}`)
    ),
    Effect.option
  )
  const segment: Segmentation = (file, text) => {
    const whole = [{ start: 0, end: text.length }]
    const rule = Array.findFirst(ordered, ({ matches }) => matches(file))
    return Option.isSome(rule) && rule.value.by === "typescript"
      ? pipe(
          typescript,
          Option.flatMap((divide) => divide(file, text)),
          // A file that does not parse, such as one with a syntax error, is still checked, as a whole.
          Option.getOrElse(() => whole)
        )
      : whole
  }
  return segment
})
