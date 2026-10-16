import { layer } from "@effect/vitest"
import { Crypto, Effect, FileSystem, Layer, pipe, Record, Ref, Schema as S, Semaphore, Stream } from "effect"
import { DecisionModel, LanguageModel } from "effect/ai"
import { expect } from "vite-plus/test"

import { check, CoverageBaselineRequired, ReviewScopeEmpty, ReviewScopeRequired } from "../toolkit/CheckTraits.ts"
import { deriveAndReview } from "../toolkit/DeriveTrait.ts"
import { Trait, TraitId, TraitName } from "../Trait.ts"
import { TraitDerivation } from "../TraitDerivation.ts"
import { TraitsConfig } from "../TraitsConfig.ts"
import { TraitsContext } from "../TraitsContext.ts"
import { layerFileSystem, TraitStore } from "../TraitStore.ts"
import { services } from "./Services.ts"

const liveTests = layer(services, { excludeTestServices: true })

liveTests((it) => {
  it.effect("covers both axes even when the caller requests only one file and trait", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "traits-coverage-" })
      yield* fs.writeFileString(`${directory}/a.ts`, "const a = 1")
      yield* fs.writeFileString(`${directory}/b.ts`, "const b = 1")
      const config = yield* pipe(
        {
          includes: ["*.ts"],
          excludeGitignored: false,
          layerDecisionModel: Layer.empty,
          layerLanguageModel: Layer.empty
        },
        S.decodeUnknownEffect(TraitsConfig)
      )
      const semaphore = yield* Semaphore.make(4)
      const calls = yield* Ref.make(0)
      const requests = yield* Ref.make(0)
      const crypto = yield* Crypto.Crypto
      const model = yield* DecisionModel.make({
        decide: (options) =>
          Ref.update(requests, (count) => count + 1).pipe(
            Effect.andThen(Ref.update(calls, (count) => count + Record.keys(options.decisions).length)),
            Effect.as({
              answers: Record.map(options.decisions, () => ({
                _tag: "Classify",
                label: "violation",
                probabilities: { compliant: 0, violation: 1, "not-applicable": 0, inconclusive: 0 }
              })),
              usage: { inputTokens: 0, outputTokens: 0 }
            })
          )
      })
      const languageModel = yield* LanguageModel.make({
        generateText: () => Effect.die("Unexpected generation"),
        streamText: () => Stream.die("Unexpected generation")
      })
      yield* Effect.gen(function* () {
        const store = yield* TraitStore
        const cold = yield* check({ include: [] }).pipe(Effect.flip)
        expect(cold).toBeInstanceOf(CoverageBaselineRequired)
        const coldCalls = yield* Ref.get(calls)
        expect(coldCalls).toBe(0)
        yield* check({ include: [], establishBaseline: true })
        const pending = yield* deriveAndReview({ name: TraitName.make("first-trait"), proposedTrait: "First trait" })
        expect(TraitDerivation.guards.ApprovalRequired(pending)).toBe(true)
        const saved = yield* deriveAndReview({
          name: TraitName.make("first-trait"),
          proposedTrait: "First trait",
          approved: true
        }).pipe(
          Effect.filterOrFail(TraitDerivation.guards.Created, () => "Expected a new trait"),
          Effect.orDie
        )
        expect(saved.findings).toHaveLength(2)
        const first = saved.trait
        const secondId = yield* crypto.randomUUIDv4
        yield* store.add(
          Trait.make({ id: TraitId.make(secondId), name: TraitName.make("second-trait"), body: "Second trait" })
        )
        const request = { include: [`${directory}/a.ts`], traitIds: [first.id] }
        const initial = yield* check(request)
        expect(initial).toHaveLength(4)
        const firstCalls = yield* Ref.get(calls)
        expect(firstCalls).toBe(4)
        const repeated = yield* check(request)
        expect(repeated).toHaveLength(4)
        const repeatedCalls = yield* Ref.get(calls)
        expect(repeatedCalls).toBe(4)
        yield* store.update(Trait.make({ ...first, body: "Revised first trait" }))
        yield* check(request)
        const updatedCalls = yield* Ref.get(calls)
        expect(updatedCalls).toBe(6)
        const thirdId = yield* crypto.randomUUIDv4
        yield* store.add(
          Trait.make({ id: TraitId.make(thirdId), name: TraitName.make("third-trait"), body: "New third trait" })
        )
        yield* check(request)
        const addedCalls = yield* Ref.get(calls)
        expect(addedCalls).toBe(8)
        // b.ts was omitted by the caller, but its new chunk still needs all traits.
        yield* fs.writeFileString(`${directory}/b.ts`, "const b = 2")
        yield* check(request)
        const editedCalls = yield* Ref.get(calls)
        expect(editedCalls).toBe(11)
        const batchedRequests = yield* Ref.get(requests)
        expect(batchedRequests).toBe(9)
        const missingScope = yield* check(request).pipe(
          Effect.provideService(TraitsContext, {
            config: TraitsConfig.make({ ...config, includes: [] }),
            configRoot: directory,
            excludes: [],
            semaphore
          }),
          Effect.flip
        )
        expect(missingScope).toBeInstanceOf(ReviewScopeRequired)
        const emptyScope = yield* check({ include: [] }).pipe(
          Effect.provideService(TraitsContext, {
            config: TraitsConfig.make({ ...config, includes: ["no-matching-files/**"] }),
            configRoot: directory,
            excludes: [],
            semaphore
          }),
          Effect.flip
        )
        expect(emptyScope).toBeInstanceOf(ReviewScopeEmpty)
      }).pipe(
        Effect.provide(layerFileSystem(`${directory}/.agents/traits`)),
        Effect.provideService(TraitsContext, { config, configRoot: directory, excludes: [], semaphore }),
        Effect.provideService(DecisionModel.DecisionModel, model),
        Effect.provideService(LanguageModel.LanguageModel, languageModel)
      )
    })
  )
})
