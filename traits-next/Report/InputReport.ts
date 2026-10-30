import { Schema as S } from "effect"

import { InputLocation } from "../schema/index.ts"
import { Assessment } from "./Assessment.ts"
import { EnrichmentReport } from "./EnrichmentReport.ts"

/** One source location's enrichments and optional assertion assessment. */
export type InputReport = typeof InputReport.Type
export const InputReport = S.Struct({
  /** The selected source version and validated location being evaluated. */
  input: InputLocation,
  /** Context produced by enrichments for this input. */
  enrichments: S.Array(EnrichmentReport),
  /** The assertion assessment, when an assertion was evaluated. */
  assessment: Assessment.pipe(S.optionalKey)
})
