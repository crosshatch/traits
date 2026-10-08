import { Array, Effect, Schema as S, String } from "effect"
import { AiError, DecisionModel, Tool, Toolkit } from "effect/ai"

import { Trait, TraitId } from "../Trait.ts"
import { check, TraitConflict } from "../TraitConflict.ts"
import { TraitsContext } from "../TraitsContext.ts"
import { TraitStore, TraitStoreError } from "../TraitStore.ts"

export const DeriveTrait = Tool.make("derive_trait", {
  description: String.stripMargin(`
  | Use after a user correction, reusable coding preference, or explicit request to remember a convention.
  | First decide whether the feedback generalizes beyond the current task and inspect existing trait files for coverage.
  | Supply a concise, standalone rule as proposedTrait, preserving its scope and exceptions; omit headings and unnecessary examples.
  | Compare against all stored traits. Only a distinct proposal is saved as a new trait.
  | Conflicts and inconclusive comparisons return Fail entries containing the existing trait and proposal; no trait is saved in that case.
  | Inspect those entries: clarify ambiguity, revise the proposal, or call resolve_conflicting_traits for an intentional replacement.
  | Covered entries mean the proposal is already represented; reuse those traits without writing a duplicate.
  | Clarification entries identify an existing trait whose wording should be made clearer; no files are changed.
  | Show the existing body and complete replacement to the user and ask approval before updating.
  | After approval of that exact body and trait ID, retry with clarificationTraitId and approved: true.
  | The tool rechecks all traits before updating, preserving the selected ID. Updated returns the saved trait.
  | Never use approved: true for an unapproved replacement, and never resolve a mere clarification by deleting traits.
  | Successful creation returns no value and saves through the configured store. Do not repeat the call to obtain a result.
  | Then call check_trait_expression on relevant TypeScript files. Read the store to obtain the new ID if you need a targeted check.
  `),
  parameters: S.Struct({
    proposedTrait: S.String.annotate({
      description:
        "The complete reusable rule to save, including scope and exceptions, rather than raw conversation text."
    }),
    clarificationTraitId: TraitId.pipe(S.optional),
    approved: S.Boolean.pipe(S.optional)
  }),
  success: S.Union([
    S.Array(S.Union([TraitConflict.cases.Fail, TraitConflict.cases.Covered, TraitConflict.cases.Clarification])),
    TraitConflict.cases.Updated,
    S.Void
  ]),
  failure: S.Union([AiError.AiError, TraitStoreError]),
  dependencies: [DecisionModel.DecisionModel, TraitStore, TraitsContext]
})
  .annotate(Tool.Title, "Derive Trait")
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, false)

export const toolkit = Toolkit.make(DeriveTrait)

export const layer = toolkit.toLayer({
  derive_trait: Effect.fnUntraced(function* (params) {
    const store = yield* TraitStore
    const traits = yield* store.ls
    const target = params.clarificationTraitId === undefined ? undefined : yield* store.get(params.clarificationTraitId)
    const inspectTrait = (trait: Trait) => check(trait, params.proposedTrait)
    const results = yield* Effect.forEach(traits, inspectTrait, { concurrency: "unbounded" })
    const failures = Array.filter(results, (result) => result._tag === "Fail")
    if (failures.length > 0) return failures

    const clarifications = Array.filter(results, (result) => result._tag === "Clarification")
    const covered = Array.filter(results, (result) => result._tag === "Covered")
    if (target !== undefined) {
      const targetClarification = Array.some(clarifications, (result) => result.trait.id === target.id)
      const otherClarifications = Array.filter(clarifications, (result) => result.trait.id !== target.id)
      if (params.approved === true && targetClarification && otherClarifications.length === 0) {
        const trait = Trait.make({ id: target.id, body: params.proposedTrait })
        yield* store.update(trait)
        return TraitConflict.cases.Updated.make({ trait })
      }
      if (clarifications.length > 0) return clarifications
      if (covered.length > 0) return covered
      return [TraitConflict.cases.Fail.make({ trait: target, proposedTrait: params.proposedTrait })]
    }
    if (clarifications.length > 0) return clarifications
    if (covered.length > 0) return covered

    yield* store.add(params.proposedTrait)
    return
  })
})
