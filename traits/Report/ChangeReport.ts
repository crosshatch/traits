import { Schema as S } from "effect"

import { InputReport } from "./InputReport.ts"

/** What one trait did with one supplied change: could not segment it, or evaluated its selected inputs. */
export type ChangeReport = typeof ChangeReport.Type
export const ChangeReport = S.TaggedUnion({
  /** The trait's segmenter failed for this change; a shared segmenter diagnostic explains why. */
  NotSegmented: {},
  /** Inputs selected from the change in deterministic order; empty when the segmenter selected nothing. */
  Evaluated: {
    /** Selected inputs in deterministic order, including failed or cancelled work; indices are report-local. */
    inputs: S.Array(InputReport).annotate({
      description:
        "Selected inputs in deterministic order, including failed or cancelled work; indices are report-local."
    })
  }
}).annotate({
  description: "What one trait did with one supplied change: could not segment it, or evaluated its selected inputs."
})
