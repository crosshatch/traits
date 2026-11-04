import { expect, it } from "@effect/vitest"
import { Array, Cause, Deferred, Effect, Exit, Fiber, Layer, pipe, Schema as S } from "effect"
import { DecisionModel } from "effect/ai"

import { check } from "../Check/Check.ts"
import { EnrichmentRegistry } from "../Enrichment/EnrichmentRegistry.ts"
import * as Enrichment from "../Enrichment/index.ts"
import * as Report from "../Report/index.ts"
import { type Change, ModuleSpecifier, Segment } from "../schema/index.ts"
import { SegmenterRegistry } from "../Segmenter/SegmenterRegistry.ts"
import { Trait } from "../Trait.ts"
import { TraitAssertion } from "../TraitAssertion.ts"
import { TraitName } from "../TraitName.ts"
import { TraitPurpose } from "../TraitPurpose.ts"

const trait = (name: string, options: Partial<Omit<Trait, "name" | "purpose">> = {}) =>
  Trait.make({
    name: TraitName.make(name),
    purpose: TraitPurpose.make("Protect correctness."),
    ...options
  })
const assertion = TraitAssertion.make("The target is correct.")
const module = ModuleSpecifier.make("test-segmenter")
const context = ModuleSpecifier.make("test-context")
const response: DecisionModel.ProviderResponse = {
  answers: {
    assertion: { _tag: "Classify", label: "fail", probabilities: { pass: 0.1, fail: 0.8, na: 0.05, uncertain: 0.05 } }
  },
  usage: { inputTokens: undefined, outputTokens: undefined }
}
const registryFrom = (loaders: {
  readonly Segmenter: SegmenterRegistry["Service"]
  readonly Enrichment: EnrichmentRegistry["Service"]
}) =>
  Layer.mergeAll(
    Layer.succeed(SegmenterRegistry, loaders.Segmenter),
    Layer.succeed(EnrichmentRegistry, loaders.Enrichment)
  )
const unusedLoaders = {
  Segmenter: () => Effect.die("Unexpected segmenter lookup"),
  Enrichment: () => Effect.die("Unexpected enrichment lookup")
}
const unused = registryFrom(unusedLoaders)
const model = Layer.effect(DecisionModel.DecisionModel, DecisionModel.make({ decide: () => Effect.succeed(response) }))

it.effect("uses whole files without segmentation and keeps execution success separate from assessment acceptance", () =>
  Effect.gen(function* () {
    let assessments = 0
    const report = yield* check({
      traits: [trait("asserted", { assertion }), trait("guidance")],
      changes: [
        { before: { path: "old.ts", text: "old" }, after: { path: "new.ts", text: "😀new" } },
        { before: { path: "removed.ts", text: "old" } },
        { after: { path: "empty.ts", text: "" } }
      ]
    }).pipe(
      Effect.provide(unused),
      Effect.provideServiceEffect(
        DecisionModel.DecisionModel,
        DecisionModel.make({
          decide: (options) =>
            Effect.sync(() => {
              assessments++
              expect(options.state).toHaveProperty("target")
              expect(options.state).toHaveProperty("input.change")
              return response
            })
        })
      )
    )
    expect(assessments).toBe(3)
    expect(Array.map(report.traits[0]!.inputs, (input) => input.segment)).toEqual([
      Segment.cases.After.make({ range: { start: 0, end: 5 } }),
      Segment.cases.Before.make({ range: { start: 0, end: 3 } }),
      Segment.cases.After.make({ range: { start: 0, end: 0 } })
    ])
    expect(
      Array.every(report.traits, (entry) => Array.every(entry.inputs, (input) => input.status === "Completed"))
    ).toBe(true)
    expect(report.traits[1]!.inputs[0]!.assessment).toBeUndefined()
    expect(report.changes).toEqual([
      { before: "old.ts", after: "new.ts" },
      { before: "removed.ts" },
      { after: "empty.ts" }
    ])
    expect(Report.isPass(report, (assessment) => assessment.pass >= 0.8)).toBe(false)
    expect(Report.isPass(report, () => true)).toBe(true)
    yield* pipe(report, S.decodeEffect(Report.Report))
  })
)

it.effect("shares segmentation across traits and validates the entire result before creating inputs", () =>
  Effect.gen(function* () {
    let setups = 0
    let executions = 0
    const registry = registryFrom({
      ...unusedLoaders,
      Segmenter: () =>
        Effect.sync(() => {
          setups++
          return (change: Change) =>
            Effect.sync(() => {
              executions++
              return [
                Segment.cases.After.make({ range: { start: 0, end: 1 } }),
                Segment.cases.After.make({ range: { start: 1, end: change.after!.path === "invalid.ts" ? 100 : 2 } })
              ]
            })
        })
    })
    const report = yield* check({
      traits: [trait("one", { segment: module }), trait("two", { segment: module })],
      changes: [{ after: { path: "invalid.ts", text: "ab" } }, { after: { path: "valid.ts", text: "ab" } }]
    }).pipe(Effect.provide(Layer.merge(registry, model)))
    expect(setups).toBe(1)
    expect(executions).toBe(2)
    expect(Array.map(report.traits, (entry) => Array.map(entry.inputs, (input) => input.change))).toEqual([
      [1, 1],
      [1, 1]
    ])
    expect(report.diagnostics).toHaveLength(1)
    expect(report.diagnostics[0]!.origin).toEqual(
      Report.DiagnosticOrigin.cases.SegmenterExecution.make({ module, change: 0 })
    )
    yield* pipe(report, S.decodeEffect(Report.Report))
  })
)

it.effect("retains empty segment selections and reports setup failures once without replacement inputs", () =>
  Effect.gen(function* () {
    const failedModule = ModuleSpecifier.make("failed-segmenter")
    const registry = registryFrom({
      ...unusedLoaders,
      Segmenter: (reference) =>
        reference === failedModule
          ? Effect.die({ secret: "do-not-report-this" })
          : Effect.succeed(() => Effect.succeed([]))
    })
    const report = yield* check({
      traits: [
        trait("empty", { segment: module }),
        trait("failed-one", { segment: failedModule }),
        trait("failed-two", { segment: failedModule })
      ],
      changes: [{ after: { path: "file.ts", text: "source" } }]
    }).pipe(Effect.provide(Layer.merge(registry, model)))
    expect(Array.map(report.traits, (entry) => entry.inputs)).toEqual([[], [], []])
    expect(report.diagnostics).toHaveLength(1)
    expect(JSON.stringify(report)).not.toContain("do-not-report-this")
    expect(Report.isPass(report, () => true)).toBe(false)
  })
)

it.effect("allows enrichment-only recovery to proceed, but blocks Input-scoped assessment", () =>
  Effect.gen(function* () {
    for (const reason of [
      Enrichment.EnrichmentErrorReason.cases.Enrichment.make({}),
      Enrichment.EnrichmentErrorReason.cases.Input.make({})
    ]) {
      const registry = registryFrom({
        ...unusedLoaders,
        Enrichment: () =>
          Effect.succeed(
            Enrichment.EnrichmentError.make({ reason, instruction: "Restore the missing context and rerun." })
          )
      })
      const report = yield* check({
        traits: [trait("example", { assertion, enrichments: [context] })],
        changes: [{ after: { path: "file.ts", text: "source" } }]
      }).pipe(Effect.provide(Layer.merge(registry, model)))
      expect(report.interrupted).toBe(false)
      expect(report.diagnostics).toHaveLength(1)
      const input = report.traits[0]!.inputs[0]!
      expect(input.status).toBe(reason._tag === "Input" ? "Failed" : "Completed")
      expect(input.assessment === undefined).toBe(reason._tag === "Input")
      yield* pipe(report, S.decodeEffect(Report.Report))
    }
  })
)

it.effect("Trait recovery cancels sibling input work without marking the check interrupted", () =>
  Effect.gen(function* () {
    const assessingSibling = yield* Deferred.make<void>()
    const registry = registryFrom({
      ...unusedLoaders,
      Segmenter: () =>
        Effect.succeed(() =>
          Effect.succeed([
            Segment.cases.After.make({ range: { start: 0, end: 1 } }),
            Segment.cases.After.make({ range: { start: 1, end: 2 } })
          ])
        ),
      Enrichment: () =>
        Effect.succeed(
          Effect.gen(function* () {
            const current = yield* Enrichment.EnrichmentContext
            if (current.input.range.start === 0) {
              yield* Deferred.await(assessingSibling)
              return yield* Enrichment.EnrichmentError.make({
                reason: Enrichment.EnrichmentErrorReason.cases.Trait.make({}),
                instruction: "Restore the trait prerequisite and rerun."
              })
            }
            return "context"
          })
        )
    })
    const report = yield* check({
      traits: [trait("recovering", { assertion, segment: module, enrichments: [context] }), trait("unaffected")],
      changes: [{ after: { path: "file.ts", text: "ab" } }]
    }).pipe(
      Effect.provide(registry),
      Effect.provideServiceEffect(
        DecisionModel.DecisionModel,
        DecisionModel.make({
          decide: () => Deferred.succeed(assessingSibling, undefined).pipe(Effect.andThen(Effect.never))
        })
      )
    )
    expect(report.interrupted).toBe(false)
    expect(Array.map(report.traits[0]!.inputs, (input) => input.status)).toEqual(["Failed", "Cancelled"])
    expect(report.traits[1]!.inputs[0]!.status).toBe("Completed")
    expect(report.diagnostics).toHaveLength(1)
    yield* pipe(report, S.decodeEffect(Report.Report))
  })
)

it.effect("normalizes assessment defects and unanswered outcomes without leaking arbitrary failure data", () =>
  Effect.gen(function* () {
    for (const outcome of ["defect", "unanswered"]) {
      const report = yield* check({
        traits: [trait("example", { assertion })],
        changes: [{ after: { path: "file.ts", text: "secret-source" } }]
      }).pipe(
        Effect.provide(unused),
        Effect.provideServiceEffect(
          DecisionModel.DecisionModel,
          DecisionModel.make({
            decide: () =>
              outcome === "defect"
                ? Effect.die({ secret: "private-error" })
                : Effect.succeed({ answers: {}, usage: { inputTokens: undefined, outputTokens: undefined } })
          })
        )
      )
      expect(report.traits[0]!.inputs[0]!.status).toBe("Failed")
      expect(report.diagnostics[0]!.origin).toEqual(
        Report.DiagnosticOrigin.cases.AssessmentExecution.make({ trait: 0, input: 0 })
      )
      expect(JSON.stringify(report)).not.toContain("private-error")
      expect(JSON.stringify(report)).not.toContain("secret-source")
      yield* pipe(report, S.decodeEffect(Report.Report))
    }
  })
)

it.effect("uses normal fiber interruption and waits for execution cleanup", () =>
  Effect.gen(function* () {
    const waiting = yield* Deferred.make<void>()
    const firstAssessed = yield* Deferred.make<void>()
    let cleaned = false
    const running = yield* check({
      traits: [trait("example", { assertion })],
      changes: [{ after: { path: "one.ts", text: "one" } }, { after: { path: "two.ts", text: "two" } }]
    }).pipe(
      Effect.provide(unused),
      Effect.provideServiceEffect(
        DecisionModel.DecisionModel,
        DecisionModel.make({
          decide: (options) =>
            Effect.gen(function* () {
              if (S.is(S.Struct({ target: S.Literal("one") }))(options.state)) {
                yield* Deferred.succeed(firstAssessed, undefined)
                return response
              }
              yield* Deferred.await(firstAssessed)
              yield* Effect.yieldNow
              return yield* Deferred.succeed(waiting, undefined).pipe(
                Effect.andThen(Effect.never),
                Effect.ensuring(
                  Effect.sync(() => {
                    cleaned = true
                  })
                )
              )
            })
        })
      ),
      Effect.forkChild
    )
    yield* Deferred.await(waiting)
    yield* Fiber.interrupt(running)
    const exit = yield* Fiber.await(running)
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(Cause.hasInterruptsOnly(exit.cause)).toBe(true)
    }
    expect(cleaned).toBe(true)
  })
)
