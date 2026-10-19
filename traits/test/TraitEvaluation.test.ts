import { expect, it } from "@effect/vitest"
import { Array, Effect, Layer, pipe, Record, Result, Semaphore, String } from "effect"
import { DecisionModel, LanguageModel } from "effect/ai"

import * as Source from "../Source.ts"
import * as Trait from "../Trait.ts"
import * as Evaluation from "../TraitEvaluation.ts"
import { TraitsContext } from "../TraitsContext.ts"

const source = Source.Source.make({ text: "const value = 1", location: Source.SourceLocation.cases.Generated.make({}) })
const traits = Array.makeBy(20, (index) =>
  Trait.Trait.make({
    name: Trait.TraitName.make(`example-trait-${index}`),
    subject: "Binding declarations.",
    requirement: "Prefer const declarations.",
    purpose: "Make immutable bindings explicit.",
    applicability: "In TypeScript, except when mutation is required."
  })
)

const run = Effect.fnUntraced(function* (
  selected: ReadonlyArray<Trait.Trait>,
  input: Source.Source = source,
  omitAnswers: boolean = false,
  circumstances?: string
) {
  const calls: Array<DecisionModel.ProviderOptions> = []
  const model = yield* DecisionModel.make({
    decide: (options) =>
      Effect.sync(() => {
        calls.push(options)
        return {
          answers: omitAnswers
            ? {}
            : Record.fromEntries(
                Array.map(Array.reverse(Record.keys(options.decisions)), (name) => [
                  name,
                  {
                    _tag: "Classify" as const,
                    label: name === selected[0]?.name ? "violation" : "compliant",
                    probabilities: {
                      compliant: name === selected[0]?.name ? 0 : 1,
                      violation: name === selected[0]?.name ? 1 : 0,
                      "not-applicable": 0,
                      inconclusive: 0
                    }
                  }
                ])
              ),
          usage: { inputTokens: undefined, outputTokens: undefined }
        }
      })
  })
  const semaphore = yield* Semaphore.make(1)
  const result = yield* Evaluation.evaluateAll(selected, input, circumstances).pipe(
    Effect.provideService(DecisionModel.DecisionModel, model),
    Effect.provideService(TraitsContext, {
      configRoot: ".",
      excludes: [],
      semaphore,
      config: {
        decisionConcurrency: 1,
        excludeGitignored: true,
        excludes: [],
        layerDecisionModel: Layer.succeed(DecisionModel.DecisionModel, model),
        layerLanguageModel: Layer.effect(
          LanguageModel.LanguageModel,
          Effect.die("Generation is not used in evaluation tests")
        )
      }
    }),
    Effect.result
  )
  return { calls, result }
})

it.effect(
  "passes invocation circumstances once alongside the source",
  Effect.fnUntraced(function* () {
    const circumstances = "Precommit verification of authored code."
    const result = yield* run(Array.take(traits, 1), source, false, circumstances)
    expect(result.calls[0]?.state).toEqual({ source, circumstances })
    expect(Result.isSuccess(result.result)).toBe(true)
  })
)

it.effect(
  "shares source once and maps name-keyed answers back to each trait in order",
  Effect.fnUntraced(function* () {
    const selected = Array.take(traits, 3)
    const { calls, result } = yield* run(selected)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.state).toEqual({ source })
    expect(Record.keys(calls[0]!.decisions)).toEqual(Array.map(selected, (trait) => trait.name))
    expect(calls[0]!.decisions[selected[0]!.name]?.instructions).toContain(JSON.stringify(selected[0]))
    expect(Result.isSuccess(result)).toBe(true)
    if (Result.isSuccess(result)) {
      expect(Array.map(result.success, (entry) => entry.trait)).toEqual(selected)
      expect(Array.map(result.success, (entry) => entry.source)).toEqual([source, source, source])
      expect(Array.map(result.success, (entry) => entry.assessment.classification)).toEqual([
        "violation",
        "compliant",
        "compliant"
      ])
      expect(Array.filter(result.success, Evaluation.requiresReview)).toHaveLength(1)
    }
  })
)

it.effect(
  "splits question counts and preserves all results",
  Effect.fnUntraced(function* () {
    const { calls, result } = yield* run(traits)
    expect(calls).toHaveLength(2)
    expect(Record.keys(calls[0]!.decisions).length).toBeLessThanOrEqual(16)
    expect(Record.keys(calls[1]!.decisions).length).toBeLessThanOrEqual(16)
    expect(Result.isSuccess(result)).toBe(true)
    if (Result.isSuccess(result)) expect(Array.map(result.success, (entry) => entry.trait)).toEqual(traits)
  })
)

it.effect(
  "splits UTF-8 request sizes without truncating trait text",
  Effect.fnUntraced(function* () {
    const selected = Array.map(Array.take(traits, 6), (trait) =>
      Trait.Trait.make({ ...trait, context: pipe("語", String.repeat(2000)) })
    )
    const { calls, result } = yield* run(selected)
    expect(calls.length).toBeGreaterThan(1)
    expect(Result.isSuccess(result)).toBe(true)
    for (const call of calls) {
      expect(new TextEncoder().encode(JSON.stringify(call)).length).toBeLessThan(25_000)
    }
    if (Result.isSuccess(result)) expect(Array.map(result.success, (entry) => entry.trait)).toEqual(selected)
  })
)

it.effect(
  "does not call the provider for empty selections",
  Effect.fnUntraced(function* () {
    const { calls, result } = yield* run([])
    expect(calls).toEqual([])
    expect(result).toEqual(Result.succeed([]))
  })
)

it.effect(
  "fails oversized inputs before sending any batch",
  Effect.fnUntraced(function* () {
    const { calls, result } = yield* run(
      traits,
      Source.Source.make({ ...source, text: pipe("x", String.repeat(24_000)) })
    )
    expect(calls).toEqual([])
    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(Evaluation.TraitAssessmentTooLargeError)
      expect(result.failure).toMatchObject({ traitName: traits[0]!.name, maxBytes: 24_000, location: source.location })
      if (result.failure._tag === "TraitAssessmentTooLargeError") {
        expect(result.failure.bytes).toBeGreaterThan(result.failure.maxBytes)
      }
    }
  })
)

it.effect(
  "fails incomplete provider answers instead of silently skipping traits",
  Effect.fnUntraced(function* () {
    const { result } = yield* run(Array.take(traits, 2), source, true)
    expect(Result.isFailure(result)).toBe(true)
  })
)
