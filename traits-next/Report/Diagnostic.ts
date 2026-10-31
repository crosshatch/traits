import { Schema as S } from "effect"

import { ModuleSpecifier, RecoveryInstruction } from "../schema/index.ts"

/** A normalized extension failure; arbitrary error values never enter the report. */
export type Diagnostic = typeof Diagnostic.Type
export const Diagnostic = S.Struct({
  /** The configured extension module. */
  module: ModuleSpecifier,
  /** Safe, nonblank failure details, excluding source text and raw error objects. */
  message: S.NonEmptyString.check(S.isPattern(/\S/u)),
  /** Actionable remediation, only when known. */
  instruction: RecoveryInstruction.pipe(S.optionalKey),
  /** The extension kind, lifecycle stage, and execution location when available. */
  origin: S.TaggedUnion({
    /** Segmenter initialization failed before selecting assessment inputs. */
    SegmenterSetup: {},
    SegmenterExecution: {
      /** Index into the caller's supplied changes, in caller order. */
      change: S.Natural
    },
    /** Enrichment initialization failed before processing assessment inputs. */
    EnrichmentSetup: {},
    EnrichmentExecution: {
      /** Report-local index into the containing trait report's inputs. */
      input: S.Natural
    }
  })
})
