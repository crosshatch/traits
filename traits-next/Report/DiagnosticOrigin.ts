import { Schema as S } from "effect"

/** The extension kind and lifecycle stage: setup origins have no location, segmenter execution references a supplied change, and enrichment execution references a trait-local input. */
export const DiagnosticOrigin = S.TaggedUnion({
  /** Segmenter initialization failed before selecting assessment inputs. */
  SegmenterSetup: {},
  SegmenterExecution: {
    /** Index into the caller's supplied changes in original caller order, before filtering or scheduling; not an input-report index. */
    change: S.Natural.annotate({
      description:
        "Index into the caller's supplied changes in original caller order, before filtering or scheduling; not an input-report index."
    })
  },
  /** Enrichment initialization failed before processing assessment inputs. */
  EnrichmentSetup: {},
  EnrichmentExecution: {
    /** Index into the containing Report.traits identifying the originating trait evaluation. */
    trait: S.Natural.annotate({
      description: "Index into the containing Report.traits identifying the originating trait evaluation."
    }),
    /** Index into the originating trait report's inputs identifying the assessment input. */
    input: S.Natural.annotate({
      description: "Index into the originating trait report's inputs identifying the assessment input."
    })
  }
}).annotate({
  description:
    "The extension kind and lifecycle stage: setup origins have no location, segmenter execution references a supplied change, and enrichment execution references a trait-local input."
})
