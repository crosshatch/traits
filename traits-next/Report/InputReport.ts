import { Schema as S } from "effect"

import { Assessment } from "./Assessment.ts"
import { EnrichmentReport } from "./EnrichmentReport.ts"

/** One input's enrichments and optional assertion assessment. */
export type InputReport = typeof InputReport.Type
export const InputReport = S.Struct({
  /** Context produced by enrichments for this input. */
  enrichments: S.Array(EnrichmentReport),
  /** The assertion assessment, when an assertion was evaluated. */
  assessment: Assessment.pipe(S.optionalKey),
  /** Recovery guidance when this trait was skipped for this input. */
  instruction: S.String.pipe(S.optionalKey)
})
