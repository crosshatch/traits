import { Schema as S } from "effect"

import { Content, InputSegment, InputSource } from "../schema/index.ts"
import { Assessment } from "./Assessment.ts"
import { EnrichmentReport } from "./EnrichmentReport.ts"

/** One source location's enrichments, outcome, and optional assertion assessment. */
export type InputReport = typeof InputReport.Type
export const InputReport = S.Struct({
  /** The selected file version, including its path and complete contents. */
  source: InputSource,
  /** The complete source or text range addressed by this report. */
  location: InputSegment,
  /** Context produced by enrichments for this input. */
  enrichments: S.Array(EnrichmentReport),
  /** The assertion assessment, when an assertion was evaluated. */
  assessment: Assessment.pipe(S.optionalKey),
  /** Present exactly when this trait was skipped for this input; contains required recovery guidance. */
  instruction: S.String.pipe(S.optionalKey)
}).check(
  S.makeFilter(
    (report) =>
      InputSegment.guards.Full(report.location) ||
      (Content.guards.Text(report.source.content) && report.location.range.end <= report.source.content.text.length),
    { message: "A range must refer to text and fit within the source's UTF-16 length." }
  )
)
