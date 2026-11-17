import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Array, Effect, FileSystem, Layer, Option, Path, pipe, Record, String } from "effect"
import { DecisionModel } from "effect/ai"
import { Digest } from "effect/crypto"
import { TestClock } from "effect/testing"

import { check } from "../Check/Check.ts"
import { CachedDecision, DecisionCache } from "../Check/DecisionCache.ts"
import { EnrichmentRegistry } from "../Enrichment/EnrichmentRegistry.ts"
import * as LocalDecisionCache from "../local/LocalDecisionCache.ts"
import { WorkspaceRoot } from "../local/WorkspaceRoot.ts"
import * as Report from "../Report/Report.ts"
import { SegmenterRegistry } from "../Segmenter/SegmenterRegistry.ts"
import { Trait } from "../Trait.ts"
import { TraitAssertion } from "../TraitAssertion.ts"
import { TraitName } from "../TraitName.ts"
import { TraitPurpose } from "../TraitPurpose.ts"
import { TraitSubject } from "../TraitSubject.ts"
import { digestText } from "../util/TextDigest.ts"
import { WorkspacePath } from "../util/WorkspacePath.ts"

const request = {
  traits: [
    {
      trait: Trait.make({
        name: TraitName.make("small-functions"),
        subject: TraitSubject.make("Functions."),
        assertion: TraitAssertion.make("Functions are small."),
        purpose: TraitPurpose.make("Keep code readable.")
      }),
      origin: Report.TraitOrigin.cases.File.make({ path: WorkspacePath.make("traits/small-functions.md") })
    }
  ],
  changes: [{ after: { path: WorkspacePath.make("a.ts"), text: "export const f = () => 1\n" } }]
}
const host = Layer.mergeAll(
  Layer.succeed(SegmenterRegistry, () => Effect.die("Unexpected segmenter")),
  Layer.succeed(EnrichmentRegistry, () => Effect.die("Unexpected enrichment")),
  Digest.layerWebCrypto
)

/** A decision model that counts its requests and answers assertions with the given answer. */
const countingModel = (assertion: DecisionModel.ProviderResponse["answers"][string]) => {
  const calls = { count: 0 }
  const layer = Layer.effect(
    DecisionModel.DecisionModel,
    DecisionModel.make({
      decide: (options) =>
        Effect.sync(() => {
          calls.count++
          return {
            answers: Record.map(options.decisions, (_decision, key) =>
              key === "assertion"
                ? assertion
                : { _tag: "Classify" as const, label: "yes", probabilities: { yes: 0.9, no: 0.05, uncertain: 0.05 } }
            ),
            usage: { inputTokens: 10, outputTokens: 0 },
            modelId: "test-model"
          }
        })
    })
  )
  return { calls, layer }
}

const memoryCache = () => {
  const entries = new Map<string, CachedDecision>()
  return Layer.succeed(DecisionCache, {
    get: (key) => Effect.sync(() => Option.fromNullishOr(entries.get(key))),
    set: (key, decision) => Effect.sync(() => void entries.set(key, decision))
  })
}

const passing = {
  _tag: "Classify" as const,
  label: "pass",
  probabilities: { pass: 0.9, fail: 0.05, na: 0.03, uncertain: 0.02 }
}

it.effect("reuses cached decisions for unchanged traits and inputs without asking the model", () =>
  Effect.gen(function* () {
    const model = countingModel(passing)
    const cache = memoryCache()
    const run = check(request).pipe(Effect.provide([host, model.layer, cache]))
    const first = yield* run
    expect(model.calls.count).toBe(2)
    const second = yield* run
    expect(model.calls.count).toBe(2)
    expect(second.traits).toEqual(first.traits)
    expect(second.run.models).toEqual(["test-model"])
    expect(second.run.usage).toEqual({ inputTokens: 0, outputTokens: 0 })
    // A changed input is decided again.
    const changed = {
      ...request,
      changes: [{ after: { ...request.changes[0]!.after, text: "x\n" } }]
    }
    yield* check(changed).pipe(Effect.provide([host, model.layer, cache]))
    expect(model.calls.count).toBe(4)
  })
)

it.effect("digests an input's text once for every trait checked against it", () =>
  Effect.gen(function* () {
    const model = countingModel(passing)
    // Far longer than any decision key, so digests of the text can be told apart from digests of keys.
    const text = pipe("export const f = () => 1\n", String.repeat(4000))
    const digested: Array<number> = []
    const digest = Layer.effect(
      Digest.Digest,
      Effect.map(Digest.Digest, (digest) =>
        Digest.Digest.of({
          ...digest,
          digestHex: (algorithm, data) => {
            digested.push(data.length)
            return digest.digestHex(algorithm, data)
          }
        })
      )
    ).pipe(Layer.provide(Digest.layerWebCrypto))
    yield* check({
      traits: Array.map(Array.range(1, 5), (index) => ({
        ...request.traits[0]!,
        trait: {
          ...request.traits[0]!.trait,
          name: TraitName.make(`small-functions-${index}`),
          subject: TraitSubject.make(`Functions of kind ${index}.`)
        }
      })),
      changes: [{ after: { path: WorkspacePath.make("a.ts"), text } }]
    }).pipe(Effect.provide(digest), Effect.provide([host, model.layer, memoryCache()]))
    expect(model.calls.count).toBe(10)
    // The target, its decision state, and the change's identity; the ten decisions key on the state's digest.
    expect(Array.filter(digested, (length) => length >= text.length)).toHaveLength(3)
  })
)

it.effect("never caches failed decisions, so they are retried", () =>
  Effect.gen(function* () {
    const model = countingModel({ _tag: "Refusal" })
    const run = check(request).pipe(Effect.provide([host, model.layer, memoryCache()]))
    yield* run
    yield* run
    // The subject decision is cached; the refused assertion is asked again.
    expect(model.calls.count).toBe(3)
  })
)

it.effect("keeps decisions in the workspace across runs, ignored by Git and scoped to the decision model", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-decision-cache-" })
    const key = yield* digestText("question")
    const decision = CachedDecision.make({ label: "pass", probabilities: { pass: 1 }, modelId: "m" })
    const cacheFor = (model: string) =>
      DecisionCache.pipe(
        Effect.provide(LocalDecisionCache.layer(model).pipe(Layer.provide(WorkspaceRoot.layer(directory))))
      )
    const writer = yield* cacheFor("model-a")
    yield* writer.set(key, decision)
    const reader = yield* cacheFor("model-a")
    const stored = yield* reader.get(key)
    expect(stored).toEqual(Option.some(decision))
    const otherModel = yield* cacheFor("model-b")
    const missing = yield* otherModel.get(key)
    expect(Option.isNone(missing)).toBe(true)
    const ignore = yield* fs.readFileString(path.join(directory, "traits", ".cache", ".gitignore"))
    expect(ignore).toBe("*\n")
  }).pipe(Effect.scoped, Effect.provide([NodeServices.layer, Digest.layerWebCrypto]))
)

it.effect("drops a decision once a whole generation passes without a check using it", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-decision-cache-" })
    const cache = DecisionCache.pipe(
      Effect.provide(LocalDecisionCache.layer("model").pipe(Layer.provide(WorkspaceRoot.layer(directory))))
    )
    const used = yield* digestText("used")
    const unused = yield* digestText("unused")
    const decision = CachedDecision.make({ label: "pass", probabilities: { pass: 1 } })
    const first = yield* cache
    yield* first.set(used, decision)
    yield* first.set(unused, decision)
    yield* TestClock.adjust("31 days")
    const second = yield* cache
    const kept = yield* second.get(used)
    expect(kept).toEqual(Option.some(decision))
    yield* TestClock.adjust("31 days")
    const third = yield* cache
    const stillKept = yield* third.get(used)
    expect(stillKept).toEqual(Option.some(decision))
    const dropped = yield* third.get(unused)
    expect(Option.isNone(dropped)).toBe(true)
  }).pipe(Effect.scoped, Effect.provide([NodeServices.layer, Digest.layerWebCrypto]))
)

it.effect("checks without remembering decisions when the cache directory cannot be prepared", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-decision-cache-" })
    // A file where the cache's parent directory belongs.
    yield* fs.writeFileString(path.join(directory, "traits"), "")
    const cache = yield* DecisionCache.pipe(
      Effect.provide(LocalDecisionCache.layer("model").pipe(Layer.provide(WorkspaceRoot.layer(directory))))
    )
    const key = yield* digestText("question")
    yield* cache.set(key, CachedDecision.make({ label: "pass", probabilities: { pass: 1 } }))
    const stored = yield* cache.get(key)
    expect(Option.isNone(stored)).toBe(true)
  }).pipe(Effect.scoped, Effect.provide([NodeServices.layer, Digest.layerWebCrypto]))
)
