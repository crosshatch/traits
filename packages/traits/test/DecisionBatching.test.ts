import { expect, it } from "@effect/vitest"
import { Array, Effect, Exit, Option, Order, Record, Result, Schema as S } from "effect"
import { AiError, Decision, DecisionModel } from "effect/ai"

import * as DecisionBatching from "../DecisionBatching.ts"
import * as Settings from "../Settings.ts"

const classify = (instructions: string) =>
  Decision.classify({ instructions, criteria: { yes: "It applies.", no: "It does not apply." } })

const input = S.Struct({ text: S.String })

const subject = (instructions: string) => Decision.make({ input, decisions: { subject: classify(instructions) } })

it.effect(
  "merges concurrent calls with the same input and decision names, splitting outcomes and usage among callers",
  () =>
    Effect.gen(function* () {
      const requests: Array<{ readonly text: unknown; readonly decisions: ReadonlyArray<string> }> = []
      const results = yield* Effect.all(
        [
          DecisionModel.decideSettled(subject("First."), { input: { text: "a" } }),
          DecisionModel.decideSettled(subject("Second."), { input: { text: "a" } }),
          DecisionModel.decideSettled(subject("Third."), { input: { text: "a" } }),
          DecisionModel.decideSettled(subject("Other input."), { input: { text: "b" } }),
          DecisionModel.decideSettled(Decision.make({ input, decisions: { assertion: classify("Other decision.") } }), {
            input: { text: "a" }
          })
        ],
        { concurrency: "unbounded" }
      ).pipe(
        Effect.provide(DecisionBatching.layer),
        Effect.provideService(
          Settings.CurrentSettings,
          Settings.Settings.make({ requests: Settings.RequestSettings.make({ batchSize: 32 }) })
        ),
        Effect.provideServiceEffect(
          DecisionModel.DecisionModel,
          DecisionModel.make({
            decide: (options) =>
              Effect.sync(() => {
                requests.push({
                  text: (options.state as { readonly text: string }).text,
                  decisions: Record.keys(options.decisions)
                })
                return {
                  answers: Record.map(options.decisions, (decision) => ({
                    _tag: "Classify",
                    label: decision._tag === "Classify" && decision.instructions === "Second." ? "no" : "yes",
                    probabilities: { yes: 0.5, no: 0.5 }
                  })),
                  usage: { inputTokens: 10, outputTokens: undefined },
                  modelId: "model"
                }
              })
          })
        )
      )
      // Merged decisions are named by caller; a call merged with no others keeps its names.
      expect(Array.sortWith(requests, (request) => request.decisions.length, Order.Number)).toEqual([
        { text: "b", decisions: ["subject"] },
        { text: "a", decisions: ["assertion"] },
        { text: "a", decisions: ["0.subject", "1.subject", "2.subject"] }
      ])
      const [first, second, third, otherInput, otherDecision] = results
      expect(Array.map([first, second, third], (response) => Record.keys(response.outcomes))).toEqual([
        ["subject"],
        ["subject"],
        ["subject"]
      ])
      expect(Result.getOrThrow(second.outcomes.subject).label).toBe("no")
      expect(Result.getOrThrow(third.outcomes.subject).label).toBe("yes")
      expect(Array.reduce([first, second, third], 0, (sum, response) => sum + response.usage.inputTokens!)).toBe(10)
      expect(first.usage.outputTokens).toBeUndefined()
      expect(first.modelId).toBe("model")
      expect(otherInput.usage.inputTokens).toBe(10)
      expect(Record.keys(otherDecision.outcomes)).toEqual(["assertion"])
    })
)

it.effect("fails every merged call when their shared request fails", () =>
  Effect.gen(function* () {
    const failure = AiError.make({
      module: "Test",
      method: "decide",
      reason: AiError.InternalProviderError.make({ description: "down" })
    })
    const exits = yield* Effect.all(
      Array.map(["First.", "Second."], (instructions) =>
        Effect.exit(DecisionModel.decideSettled(subject(instructions), { input: { text: "a" } }))
      ),
      { concurrency: "unbounded" }
    ).pipe(
      Effect.provide(DecisionBatching.layer),
      Effect.provideService(
        Settings.CurrentSettings,
        Settings.Settings.make({ requests: Settings.RequestSettings.make({ batchSize: 32 }) })
      ),
      Effect.provideServiceEffect(
        DecisionModel.DecisionModel,
        DecisionModel.make({ decide: () => Effect.fail(failure) })
      )
    )
    expect(Array.map(exits, Exit.findErrorOption)).toEqual([Option.some(failure), Option.some(failure)])
  })
)

it.effect("never merges calls into a request with more decisions than the batch size", () =>
  Effect.gen(function* () {
    const sizes: Array<number> = []
    const pair = Decision.make({ input, decisions: { first: classify("First."), second: classify("Second.") } })
    yield* Effect.all(
      [
        ...Array.makeBy(4, () => DecisionModel.decideSettled(subject("One."), { input: { text: "a" } })),
        // Two calls of two decisions cannot share a request of three.
        ...Array.makeBy(2, () => DecisionModel.decideSettled(pair, { input: { text: "a" } }))
      ],
      { concurrency: "unbounded" }
    ).pipe(
      Effect.provide(DecisionBatching.layer),
      Effect.provideServiceEffect(
        DecisionModel.DecisionModel,
        DecisionModel.make({
          decide: (options) =>
            Effect.sync(() => {
              sizes.push(Record.size(options.decisions))
              return {
                answers: Record.map(options.decisions, () => ({
                  _tag: "Classify" as const,
                  label: "yes",
                  probabilities: { yes: 0.5, no: 0.5 }
                })),
                usage: { inputTokens: undefined, outputTokens: undefined }
              }
            })
        })
      ),
      Effect.provideService(
        Settings.CurrentSettings,
        Settings.Settings.make({ requests: Settings.RequestSettings.make({ batchSize: 3 }) })
      )
    )
    expect(Array.sort(sizes, Order.Number)).toEqual([1, 2, 2, 3])
  })
)
