import { expect, it } from "@effect/vitest"
import { Array, Effect, Layer, pipe, Predicate, Record, Schema as S, Semaphore, Stream } from "effect"
import { DecisionModel, LanguageModel } from "effect/ai"
import { toCodecOpenAI } from "effect/ai/OpenAiStructuredOutput"

import * as Trait from "../Trait.ts"
import { derive } from "../TraitDerivation.ts"
import { TraitsContext } from "../TraitsContext.ts"
import * as TraitStore from "../TraitStore.ts"

const name = Trait.TraitName.make("indentation")
const original = Trait.Trait.make({
  applicability: {},
  extensionMetadata: {},
  name,
  body: "Use tabs for indentation."
})
const proposedTrait = "Use two spaces for indentation."

const harness = Effect.fn("test.harness")(function* (options: {
  readonly responseText?: string | undefined
  readonly unaffected?: Trait.Trait | undefined
  readonly relationships: Readonly<Record<Trait.TraitName, "distinct" | "clarification" | "conflict">>
}) {
  const stored = new Map([[original.name, original]])
  if (options.unaffected !== undefined) stored.set(options.unaffected.name, options.unaffected)
  const mutations: Array<string> = []
  const requests: Array<LanguageModel.ProviderOptions> = []
  const decisionModel = yield* DecisionModel.make({
    decide: Effect.fnUntraced(function* (request) {
      let label = "atomic"
      let labels = ["atomic", "decomposable"]
      if (Predicate.hasProperty(request.state, "trait")) {
        const trait = yield* pipe(request.state.trait, S.decodeUnknownEffect(Trait.Trait), Effect.orDie)
        label = options.relationships[trait.name] ?? (yield* Effect.die(`Missing relationship for ${trait.name}`))
        labels = ["distinct", "covered", "clarification", "conflict", "inconclusive"]
      }
      return {
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
      }
    })
  })
  const languageModel = yield* LanguageModel.make({
    generateText: (request) => {
      requests.push(request)
      return Effect.succeed([
        {
          type: "text",
          text:
            options.responseText ??
            JSON.stringify({ traits: [{ name, body: proposedTrait, applicability: {}, extensionMetadata: "{}" }] })
        }
      ])
    },
    streamText: () => Stream.empty,
    codecTransformer: toCodecOpenAI
  })
  const store = TraitStore.TraitStore.of({
    ls: Effect.sync(() => [...stored.values()]),
    add: (trait) =>
      Effect.suspend(() => {
        if (stored.has(trait.name)) return TraitStore.TraitAlreadyExistsError.make({ name: trait.name })
        mutations.push("add")
        stored.set(trait.name, trait)
        return Effect.succeed(trait)
      }),
    update: (trait) =>
      Effect.sync(() => {
        mutations.push("update")
        stored.set(trait.name, trait)
      }),
    get: (name) =>
      Effect.suspend(() => {
        const trait = stored.get(name)
        return trait === undefined ? TraitStore.TraitNotFoundError.make({ name }) : Effect.succeed(trait)
      }),
    rm: (names) =>
      Effect.sync(() => {
        mutations.push("rm")
        for (const name of names) stored.delete(name)
      })
  })
  const semaphore = yield* Semaphore.make(4)
  const layer = Layer.mergeAll(
    Layer.succeed(DecisionModel.DecisionModel, decisionModel),
    Layer.succeed(LanguageModel.LanguageModel, languageModel),
    Layer.succeed(TraitStore.TraitStore, store),
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
  "persists caller applicability without generation for creation and clarification",
  Effect.fnUntraced(function* () {
    const applicability = { when: "editing state", mime: "text/tsx", skip: "generated components" }
    for (const relationship of ["distinct", "clarification"] as const) {
      const test = yield* harness({ relationships: { [name]: relationship } })
      const pending = yield* derive({
        name: Trait.TraitName.make("state-updates"),
        proposedTrait,
        applicability
      }).pipe(Effect.provide(test.layer))
      expect(pending).toMatchObject({
        _tag: "ApprovalRequired",
        message: expect.stringContaining("when: editing state")
      })
      expect(test.mutations).toEqual([])
      const result = yield* derive({
        name: Trait.TraitName.make("state-updates"),
        proposedTrait,
        applicability,
        approved: true
      }).pipe(Effect.provide(test.layer))
      expect(result).toMatchObject({
        _tag: relationship === "distinct" ? "Created" : "Updated",
        instructions: expect.stringContaining(`Saved traits: ${relationship === "distinct" ? "state-updates" : name}.`),
        trait: { applicability, body: proposedTrait, name: relationship === "distinct" ? "state-updates" : name }
      })
      expect(
        test.stored.get(relationship === "distinct" ? Trait.TraitName.make("state-updates") : name)?.applicability
      ).toEqual(applicability)
      if (relationship === "clarification") {
        const cleared = yield* derive({ name, proposedTrait, applicability: {}, approved: true }).pipe(
          Effect.provide(test.layer)
        )
        expect(cleared).toMatchObject({ _tag: "Updated", trait: { applicability: {} } })
        expect(test.stored.get(name)?.applicability).toEqual({})
      }
      expect(test.requests).toEqual([])
    }
  })
)

it.effect(
  "does not generate replacements or mutate traits before approval",
  Effect.fnUntraced(function* () {
    const test = yield* harness({ relationships: { [name]: "conflict" } })
    const result = yield* derive({ name, proposedTrait, applicability: {} }).pipe(Effect.provide(test.layer))
    expect(result._tag).toBe("ApprovalRequired")
    expect(test.requests).toEqual([])
    expect(test.mutations).toEqual([])
  })
)

it.effect(
  "requests explicit JSON and updates reused names without deleting replacements",
  Effect.fnUntraced(function* () {
    const test = yield* harness({ relationships: { [name]: "conflict" } })
    test.stored.set(
      name,
      Trait.Trait.make({
        ...original,
        applicability: { mime: "text/typescript", skip: "generated files" },
        extensionMetadata: { priority: 2 }
      })
    )
    const result = yield* derive({ name, proposedTrait, applicability: {}, approved: true }).pipe(
      Effect.provide(test.layer)
    )
    expect(result._tag).toBe("Resolved")
    expect(result).toMatchObject({
      instructions: expect.stringContaining(
        "Use check_traits on all eligible files in this project, not just changed files"
      )
    })
    expect(test.mutations).toEqual(["update", "rm"])
    expect(test.stored.get(name)?.applicability).toEqual({})
    expect(test.stored.get(name)?.extensionMetadata).toEqual({})
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
      const test = yield* harness({ responseText, relationships: { [name]: "conflict" } })
      const error = yield* derive({ name, proposedTrait, applicability: {}, approved: true }).pipe(
        Effect.provide(test.layer),
        Effect.flip
      )
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
  "rejects duplicate replacement names and unaffected-name collisions before any writes",
  Effect.fnUntraced(function* () {
    const unaffected = Trait.Trait.make({
      applicability: {},
      extensionMetadata: {},
      name: Trait.TraitName.make("unrelated"),
      body: "Keep unrelated requirements."
    })
    for (const names of [
      ["replacement", "replacement"],
      ["replacement", unaffected.name]
    ]) {
      const test = yield* harness({
        relationships: { [name]: "conflict", [unaffected.name]: "distinct" },
        unaffected,
        responseText: JSON.stringify({
          traits: Array.map(names, (name) => ({
            name,
            body: proposedTrait,
            applicability: {},
            extensionMetadata: "{}"
          }))
        })
      })
      const error = yield* derive({ name, proposedTrait, applicability: {}, approved: true }).pipe(
        Effect.provide(test.layer),
        Effect.flip
      )
      expect(error).toBeInstanceOf(TraitStore.TraitAlreadyExistsError)
      expect(test.mutations).toEqual([])
      expect([...test.stored.values()]).toEqual([original, unaffected])
    }
  })
)

it.effect(
  "saves a new replacement name before removing the original",
  Effect.fnUntraced(function* () {
    const replacementName = Trait.TraitName.make("two-space-indentation")
    const test = yield* harness({
      relationships: { [name]: "conflict" },
      responseText: JSON.stringify({
        traits: [{ name: replacementName, body: proposedTrait, applicability: {}, extensionMetadata: "{}" }]
      })
    })
    const result = yield* derive({ name, proposedTrait, applicability: {}, approved: true }).pipe(
      Effect.provide(test.layer)
    )
    expect(result._tag).toBe("Resolved")
    expect(test.mutations).toEqual(["add", "rm"])
    expect([...test.stored.keys()]).toEqual([replacementName])
  })
)
