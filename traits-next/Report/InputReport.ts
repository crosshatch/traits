import { Schema as S } from "effect"

import { InputRange, InputSide } from "../schema/index.ts"
import { Assessment } from "./Assessment.ts"
import { EnrichmentReport } from "./EnrichmentReport.ts"

/** One source location's enrichments and optional assertion assessment. */
export type InputReport = typeof InputReport.Type
export const InputReport = S.Struct({
  /** Which side of the change the path and range refer to. */
  side: InputSide,
  /** The evaluated source path; source text is not included in the report. */
  path: S.NonEmptyString,
  /** The selected UTF-16 range within the text supplied for evaluation. */
  range: InputRange,
  /** Context produced by enrichments for this input. */
  enrichments: S.Array(EnrichmentReport),
  /** The assertion assessment, when an assertion was evaluated. */
  assessment: Assessment.pipe(S.optionalKey)
})
