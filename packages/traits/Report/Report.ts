import { Array, Schema as S } from "effect"

import { checkIdentityConstraints } from "../Check/checkIdentityConstraints.ts"
import { Segment } from "../util/Segment.ts"
import { Version } from "../Version.ts"
import { ChangeIdentity } from "./ChangeIdentity.ts"
import { ChangeReport } from "./ChangeReport.ts"
import { Diagnostic } from "./Diagnostic.ts"
import { DiagnosticOrigin } from "./DiagnosticOrigin.ts"
import { EnrichmentOutcome } from "./EnrichmentOutcome.ts"
import { InputReport } from "./InputReport.ts"
import { Run } from "./Run.ts"
import { TraitReport } from "./TraitReport.ts"

/** Portable, client-facing evaluation results grouped by trait and change, without source text or excerpts; retry tracking is external. */
export type Report = typeof Report.Type
export const Report = S.Struct({
  /** The traits version that produced the report; versions compatible under caret (^) semantics share the report format. */
  version: Version.annotateKey({
    description:
      "The traits version that produced the report; versions compatible under caret (^) semantics share the report format."
  }),
  /** Deterministic evaluation provenance, without timestamps, hosts, or absolute paths. */
  run: Run,
  /** Source identities for every supplied change in original caller order. */
  changes: S.Array(ChangeIdentity).annotate({
    description: "Source identities for every supplied change in original caller order."
  }),
  /** Shared extension failures, each recorded once; failures local to one input are recorded on that input. */
  diagnostics: S.Array(Diagnostic).annotate({
    description:
      "Shared extension failures, each recorded once; failures local to one input are recorded on that input."
  }),
  /** Selected traits, uniquely named, in caller order. */
  traits: S.Array(TraitReport).annotate({ description: "Selected traits, uniquely named, in caller order." })
})
  .annotate({
    description:
      "Portable, client-facing evaluation results grouped by trait and change, without source text or excerpts; retry tracking is external."
  })
  .check(
    ...checkIdentityConstraints,
    S.makeFilter(
      (report) =>
        Array.every(report.traits, (trait) => trait.changes.length === report.changes.length) &&
        Array.every(report.diagnostics, (diagnostic) =>
          DiagnosticOrigin.match(diagnostic.origin, {
            SegmenterSetup: (origin) => Array.some(report.traits, (trait) => trait.trait.segment === origin.module),
            SegmenterExecution: (origin) =>
              origin.change < report.changes.length &&
              Array.some(report.traits, (trait) => trait.trait.segment === origin.module),
            EnrichmentSetup: (origin) =>
              Array.some(report.traits, (trait) => trait.trait.enrichments?.includes(origin.module) === true)
          })
        ),
      {
        message:
          "Trait reports must have one result per reported change, and diagnostics must name configured modules and reported changes."
      }
    ),
    S.makeFilter(
      (report) => {
        const failedSetup = (module: string) =>
          Array.some(
            report.diagnostics,
            (diagnostic) =>
              (DiagnosticOrigin.guards.SegmenterSetup(diagnostic.origin) ||
                DiagnosticOrigin.guards.EnrichmentSetup(diagnostic.origin)) &&
              diagnostic.origin.module === module
          )
        const failedSegmentation = (module: string, change: number) =>
          failedSetup(module) ||
          Array.some(
            report.diagnostics,
            (diagnostic) =>
              DiagnosticOrigin.guards.SegmenterExecution(diagnostic.origin) &&
              diagnostic.origin.module === module &&
              diagnostic.origin.change === change
          )
        return Array.every(report.traits, (trait) =>
          Array.every(trait.changes, (result, index) => {
            const change = report.changes[index]!
            const segmenter = trait.trait.segment
            return ChangeReport.match(result, {
              NotSegmented: () => segmenter !== undefined && failedSegmentation(segmenter, index),
              Evaluated: (evaluated) =>
                (segmenter === undefined || !failedSegmentation(segmenter, index)) &&
                Array.every(
                  evaluated.inputs,
                  (input) =>
                    (Segment.guards.Before(input.segment)
                      ? change.before !== undefined
                      : change.after !== undefined &&
                        (input.segment.before === undefined ||
                          input.segment.before.length === 0 ||
                          change.before !== undefined)) &&
                    (InputReport.guards.Unmatched(input) ||
                      Array.every(
                        input.enrichments,
                        (enrichment) =>
                          EnrichmentOutcome.guards.SetupFailed(enrichment) === failedSetup(enrichment.module)
                      ))
                )
            })
          })
        )
      },
      {
        message:
          "Changes are NotSegmented exactly when a segmenter diagnostic explains it, enrichments are SetupFailed exactly when their setup failed, and inputs must select reported source sides."
      }
    )
  )

export { fromReport as verdicts } from "./ReportVerdicts.ts"
export { fromReport as problems } from "./Problem.ts"

export { TraitAssessment as Assessment } from "../TraitAssessment.ts"
export * from "./ChangeReport.ts"
export * from "../DecisionPolicy.ts"
export * from "./Diagnostic.ts"
export * from "./DiagnosticOrigin.ts"
export * from "./EnrichmentOutcome.ts"
export * from "./Explanation.ts"
export * from "./InputReport.ts"
export { Problem } from "./Problem.ts"
export { ReportVerdicts } from "./ReportVerdicts.ts"
export { TraitSubjectMatch as SubjectMatch } from "../TraitSubjectMatch.ts"
export * from "../TraitOrigin.ts"
export * from "./TraitReport.ts"
export * from "./Verdict.ts"
// These modules also export the operations that build their types, named for use behind the module's own name
// (ChangeIdentity.fromChange), so only their schemas join the report's exports.
export { ChangeIdentity } from "./ChangeIdentity.ts"
export { Run } from "./Run.ts"
export { SourceIdentity } from "./SourceIdentity.ts"
