import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Array, Effect, FileSystem, Layer, Option, Path, Record } from "effect"
import { DecisionModel } from "effect/ai"
import { Digest } from "effect/crypto"

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
import { TextDigest, WorkspacePath } from "../util/util.ts"

const request = {
  traits: [
    {
      trait: Trait.make({
        name: TraitName.make("small-functions"),
        subject: TraitSubject.make("Functions."),
        assertion: TraitAssertion.make("Functions are small."),
        purpose: TraitPurpose.make("Keep code readable.")
      }),
      origin: Report.TraitOrigin.cases.File.make({ path: WorkspacePath.make(".agents/traits/small-functions.md") })
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

it.live("keeps decisions in the workspace across runs, ignored by Git and scoped to the decision model", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-decision-cache-" })
    const key = yield* TextDigest.make("question")
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
    const ignore = yield* fs.readFileString(path.join(directory, ".agents", "traits", ".cache", ".gitignore"))
    expect(ignore).toBe("*\n")
    const files = yield* fs.readDirectory(path.join(directory, ".agents", "traits", ".cache", "decisions"))
    expect(Array.length(files)).toBe(1)
  }).pipe(Effect.scoped, Effect.provide([NodeServices.layer, Digest.layerWebCrypto]))
)
