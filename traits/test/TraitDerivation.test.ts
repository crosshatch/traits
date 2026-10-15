import { Effect, Layer, Predicate, Semaphore, Stream } from "effect"
import { DecisionModel, LanguageModel } from "effect/ai"
import { toCodecOpenAI } from "effect/ai/OpenAiStructuredOutput"
import { expect, it } from "vite-plus/test"

import { checkDecomposability, Trait, TraitId } from "../Trait.ts"
import { derive } from "../TraitDerivation.ts"
import { TraitsContext } from "../TraitsContext.ts"
import { TraitStore } from "../TraitStore.ts"

const original = Trait.make({ id: TraitId.make("original"), body: "Use tabs for indentation." })
const proposedTrait = "Use two spaces for indentation."

const harness = Effect.fn("test.harness")(function* (options: {
  readonly responseText?: string
  readonly decomposable?: boolean
}) {
  const stored = new Map([[original.id, original]])
  const mutations: Array<string> = []
  const requests: Array<LanguageModel.ProviderOptions> = []
  const decisionModel = yield* DecisionModel.make({
    decide: ({ state }) => {
      const relationship = Predicate.hasProperty(state, "trait")
      const label = relationship ? "conflict" : options.decomposable === true ? "decomposable" : "atomic"
      const labels = relationship
        ? ["distinct", "covered", "clarification", "conflict", "inconclusive"]
        : ["atomic", "decomposable"]
      return Effect.succeed({
        answers: {
          assessment: {
            _tag: "Classify",
            label,
            probabilities: Object.fromEntries(labels.map((key) => [key, key === label ? 1 : 0]))
          }
        },
        usage: { inputTokens: 0, outputTokens: 0 }
      })
    }
  })
  const languageModel = yield* LanguageModel.make({
    generateText: (request) => {
      requests.push(request)
      return Effect.succeed([
        { type: "text", text: options.responseText ?? JSON.stringify({ traits: [{ body: proposedTrait }] }) }
      ])
    },
    streamText: () => Stream.empty,
    codecTransformer: toCodecOpenAI
  })
  const store = TraitStore.of({
    ls: Effect.sync(() => [...stored.values()]),
    add: (body) =>
      Effect.sync(() => {
        const trait = Trait.make({ id: TraitId.make(`replacement-${stored.size}`), body })
        mutations.push("add")
        stored.set(trait.id, trait)
        return trait
      }),
    update: (trait) =>
      Effect.sync(() => {
        mutations.push("update")
        stored.set(trait.id, trait)
      }),
    get: () => Effect.succeed(original),
    rm: (ids) =>
      Effect.sync(() => {
        mutations.push("rm")
        for (const id of ids) stored.delete(id)
      })
  })
  const layer = Layer.mergeAll(
    Layer.succeed(DecisionModel.DecisionModel, decisionModel),
    Layer.succeed(LanguageModel.LanguageModel, languageModel),
    Layer.succeed(TraitStore, store),
    Layer.succeed(TraitsContext, {
      configRoot: "/test",
      excludes: [],
      semaphore: yield* Semaphore.make(4),
      config: {
        decisionConcurrency: 4,
        excludeGitignored: true,
        excludes: [],
        layerDecisionModel: Layer.succeed(DecisionModel.DecisionModel, decisionModel),
        layerLanguageModel: Layer.succeed(LanguageModel.LanguageModel, languageModel)
      }
    })
  )
  return { stored, mutations, requests, layer }
})

it("does not generate replacements or mutate traits before approval", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const test = yield* harness({})
      const result = yield* derive({ proposedTrait }).pipe(Effect.provide(test.layer))
      expect(result._tag).toBe("ApprovalRequired")
      expect(test.requests).toEqual([])
      expect(test.mutations).toEqual([])
    })
  ))

it("requests explicit JSON and saves replacements before removing originals", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const test = yield* harness({})
      const result = yield* derive({ proposedTrait, approved: true }).pipe(Effect.provide(test.layer))
      expect(result._tag).toBe("Resolved")
      expect(test.mutations).toEqual(["add", "rm"])
      expect([...test.stored.values()].map((trait) => trait.body)).toEqual([proposedTrait])
      expect(test.requests).toHaveLength(1)
      expect(test.requests[0]?.prompt.content[0]).toMatchObject({
        role: "system",
        content: expect.stringContaining('Return only a JSON object with this shape: {"traits":[{"body":')
      })
    })
  ))

it.each(["Use two spaces for indentation.", '{"traits":[]}'])(
  "leaves originals untouched when generation returns invalid output: %s",
  (responseText) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const test = yield* harness({ responseText })
        const error = yield* derive({ proposedTrait, approved: true }).pipe(Effect.provide(test.layer), Effect.flip)
        expect(error).toMatchObject({
          module: "LanguageModel",
          method: "generateObject",
          reason: { _tag: "StructuredOutputError" }
        })
        expect(test.mutations).toEqual([])
        expect([...test.stored.values()]).toEqual([original])
      })
    )
)

it("requests the distinct JSON shape required for decomposition", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const bodies = ["Use two spaces for indentation.", "Use single quotes."]
      const test = yield* harness({ decomposable: true, responseText: JSON.stringify({ traits: bodies }) })
      const result = yield* checkDecomposability(bodies.join(" ")).pipe(Effect.provide(test.layer))
      expect(result).toEqual(bodies)
      expect(test.requests[0]?.prompt.content[0]).toMatchObject({
        role: "system",
        content: expect.stringContaining('Return only a JSON object with this shape: {"traits":["')
      })
      expect(test.mutations).toEqual([])
    })
  ))
