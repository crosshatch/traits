import { NodeCrypto } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Array, Effect, Layer, pipe, Predicate, Record, Semaphore, Stream } from "effect"
import { DecisionModel, LanguageModel } from "effect/ai"
import { toCodecOpenAI } from "effect/ai/OpenAiStructuredOutput"

import * as Trait from "../Trait.ts"
import { derive } from "../TraitDerivation.ts"
import { TraitsContext } from "../TraitsContext.ts"
import { TraitNotFoundError, TraitStore } from "../TraitStore.ts"

const name = Trait.TraitName.make("indentation")
const original = Trait.Trait.make({
  id: Trait.TraitId.make("2535ceab-5702-4ab4-932a-f87362adf8c6"),
  name,
  body: "Use tabs for indentation."
})
const proposedTrait = "Use two spaces for indentation."

const harness = Effect.fn("test.harness")(function* (options: {
  readonly decomposable?: boolean | undefined
  readonly responseText?: string | undefined
}) {
  const stored = new Map([[original.id, original]])
  const mutations: Array<string> = []
  const requests: Array<LanguageModel.ProviderOptions> = []
  const decisionModel = yield* DecisionModel.make({
    decide: (request) => {
      const relationship = Predicate.hasProperty(request.state, "trait")
      const label = relationship ? "conflict" : options.decomposable === true ? "decomposable" : "atomic"
      const labels = relationship
        ? ["distinct", "covered", "clarification", "conflict", "inconclusive"]
        : ["atomic", "decomposable"]
      return Effect.succeed({
        answers: {
          assessment: {
            _tag: "Classify",
            label,
            probabilities: pipe(
              labels,
              Array.map((key) => [key, key === label ? 1 : 0] as const),
              Record.fromEntries
            )
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
        {
          type: "text",
          text:
            options.responseText ?? JSON.stringify({ traits: [{ name, body: proposedTrait, extensionMetadata: "{}" }] })
        }
      ])
    },
    streamText: () => Stream.empty,
    codecTransformer: toCodecOpenAI
  })
  const store = TraitStore.of({
    ls: Effect.sync(() => [...stored.values()]),
    add: (trait) =>
      Effect.sync(() => {
        mutations.push("add")
        stored.set(trait.id, trait)
        return trait
      }),
    update: (trait) =>
      Effect.sync(() => {
        mutations.push("update")
        stored.set(trait.id, trait)
      }),
    get: (id) =>
      Effect.suspend(() => {
        const trait = stored.get(id)
        return trait === undefined ? TraitNotFoundError.make({ id }) : Effect.succeed(trait)
      }),
    rm: (ids) =>
      Effect.sync(() => {
        mutations.push("rm")
        for (const id of ids) stored.delete(id)
      })
  })
  const semaphore = yield* Semaphore.make(4)
  const layer = Layer.mergeAll(
    NodeCrypto.layer,
    Layer.succeed(DecisionModel.DecisionModel, decisionModel),
    Layer.succeed(LanguageModel.LanguageModel, languageModel),
    Layer.succeed(TraitStore, store),
    Layer.succeed(TraitsContext, {
      configRoot: "/test",
      excludes: [],
      semaphore,
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

it.effect(
  "does not generate replacements or mutate traits before approval",
  Effect.fnUntraced(function* () {
    const test = yield* harness({})
    const result = yield* derive({ name, proposedTrait }).pipe(Effect.provide(test.layer))
    expect(result._tag).toBe("ApprovalRequired")
    expect(test.requests).toEqual([])
    expect(test.mutations).toEqual([])
  })
)

it.effect(
  "requests explicit JSON and saves replacements before removing originals",
  Effect.fnUntraced(function* () {
    const test = yield* harness({})
    const result = yield* derive({ name, proposedTrait, approved: true }).pipe(Effect.provide(test.layer))
    expect(result._tag).toBe("Resolved")
    expect(test.mutations).toEqual(["add", "rm"])
    expect(
      pipe(
        test.stored.values(),
        Array.fromIterable,
        Array.map((trait) => trait.body)
      )
    ).toEqual([proposedTrait])
    expect(test.requests).toHaveLength(1)
    expect(test.requests[0]?.prompt.content[0]).toMatchObject({
      role: "system",
      content: expect.stringContaining('Return only a JSON object with this shape: {"traits":[{"name":')
    })
  })
)

it.effect(
  "leaves originals untouched when generation returns invalid output",
  Effect.fnUntraced(function* () {
    for (const responseText of ["Use two spaces for indentation.", '{"traits":[]}']) {
      const test = yield* harness({ responseText })
      const error = yield* derive({ name, proposedTrait, approved: true }).pipe(Effect.provide(test.layer), Effect.flip)
      expect(error).toMatchObject({
        module: "LanguageModel",
        method: "generateObject",
        reason: { _tag: "StructuredOutputError" }
      })
      expect(test.mutations).toEqual([])
      expect([...test.stored.values()]).toEqual([original])
    }
  })
)

it.effect(
  "requests the distinct JSON shape required for decomposition",
  Effect.fnUntraced(function* () {
    const bodies = ["Use two spaces for indentation.", "Use single quotes."]
    const test = yield* harness({ decomposable: true, responseText: JSON.stringify({ traits: bodies }) })
    const result = yield* Trait.checkDecomposability(Array.join(bodies, " ")).pipe(Effect.provide(test.layer))
    expect(result).toEqual(bodies)
    expect(test.requests[0]?.prompt.content[0]).toMatchObject({
      role: "system",
      content: expect.stringContaining('Return only a JSON object with this shape: {"traits":["')
    })
    expect(test.mutations).toEqual([])
  })
)
