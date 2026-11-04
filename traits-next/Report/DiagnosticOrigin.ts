import { Schema as S } from "effect"

import { ModuleSpecifier } from "../schema/index.ts"

/** Failure provenance: extensions identify their module and lifecycle stage; assessment execution identifies only a trait-local input. */
export type DiagnosticOrigin = typeof DiagnosticOrigin.Type
export const DiagnosticOrigin = S.TaggedUnion({
  /** Segmenter initialization failed before selecting assessment inputs. */
  SegmenterSetup: {
    /** The configured segmenter module whose initialization failed. */
    module: ModuleSpecifier.annotateKey({ description: "The configured segmenter module whose initialization failed." })
  },
  SegmenterExecution: {
    /** The configured segmenter module whose execution failed. */
    module: ModuleSpecifier.annotateKey({ description: "The configured segmenter module whose execution failed." }),
    /** Index into Report.changes in original caller order; not an input-report index. */
    change: S.Natural.annotate({
      description: "Index into Report.changes in original caller order; not an input-report index."
    })
  },
  /** Enrichment initialization failed before processing assessment inputs. */
  EnrichmentSetup: {
    /** The configured enrichment module whose initialization failed. */
    module: ModuleSpecifier.annotateKey({
      description: "The configured enrichment module whose initialization failed."
    })
  },
  EnrichmentExecution: {
    /** The configured enrichment module whose execution failed. */
    module: ModuleSpecifier.annotateKey({ description: "The configured enrichment module whose execution failed." }),
    /** Index into the containing Report.traits identifying the originating trait evaluation. */
    trait: S.Natural.annotate({
      description: "Index into the containing Report.traits identifying the originating trait evaluation."
    }),
    /** Index into the originating trait report's inputs identifying the assessment input. */
    input: S.Natural.annotate({
      description: "Index into the originating trait report's inputs identifying the assessment input."
    })
  },
  AssessmentExecution: {
    /** Index into Report.traits identifying the trait whose assertion assessment failed. */
    trait: S.Natural.annotateKey({
      description: "Index into Report.traits identifying the trait whose assertion assessment failed."
    }),
    /** Index into the originating trait report's inputs identifying the failed assessment. */
    input: S.Natural.annotateKey({
      description: "Index into the originating trait report's inputs identifying the failed assessment."
    })
  }
}).annotate({
  description:
    "Failure provenance: extensions identify their module and lifecycle stage; assessment execution identifies only a trait-local input."
})
