import { Cause, Effect, Option, Predicate, Schema as S } from "effect"

import * as Enrichment from "../Enrichment/index.ts"
import * as Report from "../Report/index.ts"
import { RecoveryInstruction } from "../schema/index.ts"
import * as Segmenter from "../Segmenter/index.ts"

/** Normalizes only recognized stage errors; arbitrary failures and defects never supply report text. */
export const failure = (options: {
  readonly cause: Cause.Cause<unknown>
  readonly origin: Report.DiagnosticOrigin
}) => {
  const { cause, origin } = options
  if (Cause.hasInterruptsOnly(cause)) {
    return Effect.undefined
  }
  const generic = Report.Diagnostic.cases.Error.make({
    origin,
    error: Report.DiagnosticOrigin.match(origin, {
      SegmenterSetup: () => "Segmenter initialization failed.",
      SegmenterExecution: () => "Segmentation failed or returned invalid inputs.",
      EnrichmentSetup: () => "Enrichment initialization failed.",
      EnrichmentExecution: () => "Enrichment execution failed.",
      AssessmentExecution: () => "Assertion assessment failed or returned invalid probabilities."
    })
  })
  const fallback = { diagnostic: generic, recovery: undefined }
  return Effect.try(() => {
    const error = Option.getOrUndefined(Cause.findErrorOption(cause))
    const recognized = Report.DiagnosticOrigin.match(origin, {
      SegmenterSetup: () => S.is(Segmenter.SegmenterSetupError)(error),
      SegmenterExecution: () => S.is(Segmenter.SegmenterError)(error),
      EnrichmentSetup: () => S.is(Enrichment.EnrichmentSetupError)(error),
      EnrichmentExecution: () => S.is(Enrichment.EnrichmentError)(error),
      AssessmentExecution: () => false
    })
    if (recognized && Predicate.hasProperty(error, "instruction") && S.is(RecoveryInstruction)(error.instruction)) {
      return {
        diagnostic: Report.Diagnostic.cases.Instruction.make({ origin, instruction: error.instruction }),
        recovery: S.is(Enrichment.EnrichmentError)(error) ? error.reason._tag : undefined
      }
    }
    return fallback
  }).pipe(
    // Malformed recovery objects must not prevent normalization of the original failure.
    Effect.catchTags({ UnknownError: () => Effect.succeed(fallback) })
  )
}
