import { expect, it } from "@effect/vitest"
import { Effect, pipe, Schema as S } from "effect"

import * as Report from "../Report/index.ts"
import { ModuleSpecifier, Segment } from "../schema/index.ts"

const trait = { name: "example", purpose: "Protect correctness.", assertion: "The code is correct." }
const input = {
  change: 0,
  segment: Segment.cases.After.make({ range: { start: 0, end: 1 } }),
  status: "Completed",
  enrichments: [],
  assessment: { pass: 0.9, fail: 0.05, na: 0.03, uncertain: 0.02 }
}
const reportWith = (
  selectedInput: unknown,
  selectedTrait: unknown = trait,
  diagnostics: ReadonlyArray<unknown> = []
) => ({
  changes: [{ after: "file.ts" }],
  interrupted: false,
  diagnostics,
  traits: [{ trait: selectedTrait, inputs: [selectedInput] }]
})

it.effect("separates completed execution from policy-dependent assessment acceptance", () =>
  Effect.gen(function* () {
    const report = yield* pipe(reportWith(input), S.decodeUnknownEffect(Report.Report))
    expect(Report.isPass(report, (assessment) => assessment.pass >= 0.8)).toBe(true)
    expect(Report.isPass((assessment) => assessment.pass >= 0.99)(report)).toBe(false)
    expect(Report.isPass({ ...report, interrupted: true }, () => true)).toBe(false)
    expect(
      Report.isPass({ ...report, instruction: "Restore the unavailable model and rerun evaluation." }, () => true)
    ).toBe(false)
  })
)

it.effect("requires execution status and assessments only for completed assertion inputs", () =>
  Effect.gen(function* () {
    const { status: _status, ...withoutStatus } = input
    const { assessment: _assessment, ...withoutAssessment } = input
    expect(S.is(Report.InputReport)(withoutStatus)).toBe(false)
    expect(S.is(Report.Report)(reportWith(withoutAssessment))).toBe(false)
    for (const status of ["Failed", "Cancelled"]) {
      expect(S.is(Report.Report)(reportWith({ ...input, status }))).toBe(false)
      const report = yield* pipe(reportWith({ ...withoutAssessment, status }), S.decodeUnknownEffect(Report.Report))
      expect(Report.isPass(report, () => true)).toBe(false)
    }
    const guidance = { name: trait.name, purpose: trait.purpose }
    const report = yield* pipe(reportWith(withoutAssessment, guidance), S.decodeUnknownEffect(Report.Report))
    expect(Report.isPass(report, () => false)).toBe(true)
    expect(S.is(Report.Report)(reportWith(input, guidance))).toBe(false)
    for (const status of ["Failed", "Cancelled"]) {
      const unfinished = yield* pipe(
        reportWith({ ...withoutAssessment, status }, guidance),
        S.decodeUnknownEffect(Report.Report)
      )
      expect(Report.isPass(unfinished, () => true)).toBe(false)
    }
  })
)

it.effect("locates assessment failures without inventing an extension module", () =>
  Effect.gen(function* () {
    const origin = Report.DiagnosticOrigin.cases.AssessmentExecution.make({ trait: 0, input: 0 })
    const diagnostic = Report.Diagnostic.cases.Error.make({ origin, error: "Assessment request failed." })
    expect(diagnostic).not.toHaveProperty("module")
    expect(diagnostic.origin).not.toHaveProperty("module")
    const failed = { change: input.change, segment: input.segment, status: "Failed", enrichments: [] }
    const report = yield* pipe(reportWith(failed, trait, [diagnostic]), S.decodeUnknownEffect(Report.Report))
    expect(Report.isPass(report, () => true)).toBe(false)
    expect(S.is(Report.Report)(reportWith(input, trait, [diagnostic]))).toBe(false)
    for (const invalidOrigin of [
      Report.DiagnosticOrigin.cases.AssessmentExecution.make({ trait: 1, input: 0 }),
      Report.DiagnosticOrigin.cases.AssessmentExecution.make({ trait: 0, input: 1 })
    ]) {
      const invalid = Report.Diagnostic.cases.Error.make({ origin: invalidOrigin, error: "Assessment request failed." })
      expect(S.is(Report.Report)(reportWith(failed, trait, [invalid]))).toBe(false)
    }
    const guidance = { name: trait.name, purpose: trait.purpose }
    expect(S.is(Report.Report)(reportWith(failed, guidance, [diagnostic]))).toBe(false)
  })
)

it("requires configured extension modules on extension origins", () => {
  const module = ModuleSpecifier.make("example-segmenter")
  const origin = Report.DiagnosticOrigin.cases.SegmenterExecution.make({ module, change: 0 })
  const diagnostic = Report.Diagnostic.cases.Instruction.make({ origin, instruction: "Fix the syntax and rerun." })
  expect(S.is(Report.Report)(reportWith(input, { ...trait, segment: module }, [diagnostic]))).toBe(true)
  expect(S.is(Report.Report)(reportWith(input, trait, [diagnostic]))).toBe(false)
  expect(S.is(Report.DiagnosticOrigin)({ _tag: "SegmenterExecution", change: 0 })).toBe(false)
  expect(S.is(Report.DiagnosticOrigin)({ _tag: "EnrichmentSetup" })).toBe(false)
})
