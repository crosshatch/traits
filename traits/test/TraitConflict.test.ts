import { NodeCrypto } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Effect, Layer, Semaphore } from "effect"
import { DecisionModel, LanguageModel } from "effect/ai"

import * as Trait from "../Trait.ts"
import * as TraitConflict from "../TraitConflict.ts"
import * as TraitDerivation from "../TraitDerivation.ts"
import { TraitsContext } from "../TraitsContext.ts"
import { TraitStore } from "../TraitStore.ts"

const trait = Trait.Trait.make({
  id: Trait.TraitId.make("2535ceab-5702-4ab4-932a-f87362adf8c6"),
  name: Trait.TraitName.make("direct_callbacks"),
  body: "Pass compatible callbacks directly.",
  when: "passing callbacks.",
  mime: "text/typescript",
  skip: "When receiver preservation requires a wrapper."
})

for (const coverage of ["complete", "incomplete", "inconclusive"] as const) {
  it.effect(
    `independently verifies covered candidates: ${coverage}`,
    Effect.fnUntraced(function* () {
      const calls: Array<DecisionModel.ProviderOptions> = []
      const model = yield* DecisionModel.make({
        decide: (options) =>
          Effect.sync(() => {
            calls.push(options)
            if ("assessment" in options.decisions) {
              return {
                answers: {
                  assessment: {
                    _tag: "Classify" as const,
                    label: "covered",
                    probabilities: { distinct: 0, covered: 1, clarification: 0, conflict: 0, inconclusive: 0 }
                  }
                },
                usage: { inputTokens: undefined, outputTokens: undefined }
              }
            }
            return {
              answers: {
                coverage: {
                  _tag: "Classify" as const,
                  label: coverage,
                  probabilities: {
                    complete: coverage === "complete" ? 1 : 0,
                    incomplete: coverage === "incomplete" ? 1 : 0,
                    inconclusive: coverage === "inconclusive" ? 1 : 0
                  }
                }
              },
              usage: { inputTokens: undefined, outputTokens: undefined }
            }
          })
      })
      const semaphore = yield* Semaphore.make(1)
      const proposal = "Also eliminate forwarding service methods using curried overloads."
      const context = TraitsContext.of({
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
            Effect.die("Generation is not used in coverage checks")
          )
        }
      })
      const result = yield* TraitConflict.check(trait, proposal).pipe(
        Effect.provideService(DecisionModel.DecisionModel, model),
        Effect.provideService(TraitsContext, context)
      )
      expect(calls).toHaveLength(2)
      expect(calls[1]?.state).toMatchObject({ trait })
      if (coverage === "complete") {
        expect(TraitConflict.TraitConflict.guards.Covered(result)).toBe(true)
      } else {
        expect(result).toMatchObject({
          _tag: "Fail",
          existing: trait,
          reason: coverage === "incomplete" ? "coverage_gap" : "inconclusive"
        })
      }
      const derived = yield* TraitDerivation.derive({ name: trait.name, proposedTrait: proposal }).pipe(
        Effect.provideService(DecisionModel.DecisionModel, model),
        Effect.provideService(TraitsContext, context),
        Effect.provide(
          Layer.mergeAll(
            Layer.mock(TraitStore, { ls: Effect.succeed([trait]) }),
            Layer.mock(LanguageModel.LanguageModel, { [LanguageModel.TypeId]: LanguageModel.TypeId }),
            NodeCrypto.layer
          )
        )
      )
      if (coverage === "complete") {
        expect(TraitDerivation.TraitDerivation.guards.Covered(derived)).toBe(true)
      } else if (coverage === "incomplete") {
        expect(TraitDerivation.TraitDerivation.guards.ApprovalRequired(derived)).toBe(true)
        if (TraitDerivation.TraitDerivation.guards.ApprovalRequired(derived)) {
          expect(derived.message).toContain(trait.id)
          expect(derived.message).toContain(trait.when)
          expect(derived.message).toContain("incomplete coverage")
        }
      } else {
        expect(TraitDerivation.TraitDerivation.guards.Inconclusive(derived)).toBe(true)
      }
    })
  )
}
