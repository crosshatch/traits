import { Array, Effect, Schema as S, String } from "effect"
import { AiError, DecisionModel, McpSchema, Tool, Toolkit } from "effect/ai"

import * as Approval from "../_util/Approval.ts"
import { Trait } from "../Trait.ts"
import { check, TraitConflict } from "../TraitConflict.ts"
import { TraitsContext } from "../TraitsContext.ts"
import { TraitStore, TraitStoreError } from "../TraitStore.ts"

export const DeriveTrait = Tool.make("derive_trait", {
  description: String.stripMargin(`
  | Use after a user correction, reusable coding preference, or explicit request to remember a convention.
  | Recognize preferences across turns, including approval of a suggested alternative idiom; do not require the words "always" or "trait".
  | Err on the side of proposing a rule unless an existing trait clearly covers its exact scope. Call this tool with the draft first; do not ask separately beforehand.
  | An explicit request to save the rule counts as approval; approval to change code alone does not.
  | Native clients receive an approval form. ApprovalRequired means use the interactive question tool with Save, Revise, and Skip choices and its free-text option.
  | Include the full returned message. Retry with the exact same body and target and approved: true only after Save; revise and request approval again for changed text.
  | RevisionRequired contains feedback; revise and resubmit. Declined means stop without writing. Never retry automatically after a decline.
  | If Revise supplies no concrete feedback, ask for revision details with the interactive question UI and free text. Do not guess or set approved: true.
  | Keep the proposal pending through related work and return to it afterward unless cancelled; obtain fresh approval of the complete revised body.
  | First decide whether the feedback generalizes beyond the current task and inspect existing trait files for coverage.
  | Supply a concise, standalone rule as proposedTrait, preserving its scope and exceptions; omit headings and unnecessary examples.
  | Compare against all stored traits. Only a distinct proposal is saved as a new trait.
  | Conflicts and inconclusive comparisons return Fail entries containing the existing trait and proposal; no trait is saved in that case.
  | Inspect those entries: clarify ambiguity, revise the proposal, or call resolve_conflicting_traits for an intentional replacement.
  | Covered entries mean the proposal is already represented; reuse those traits without writing a duplicate.
  | A single clarification candidate is selected automatically for approval; provide a complete replacement body preserving existing requirements and exceptions.
  | Multiple clarification candidates return Clarification entries without writing. Refine the proposal or clarify intent rather than choosing an ID arbitrarily.
  | The shared approval flow shows the existing and proposed bodies; ask in the client UI only if ApprovalRequired is returned.
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
    approved: S.Boolean.pipe(S.optional).annotate({
      description:
        "Fallback approval for the exact proposal and automatically selected action shown to the user, including any existing trait being updated. Set true only after approval; native clients still receive a form. Does not bypass relationship checks."
    })
  }),
  success: S.Union([
    S.Array(S.Union([TraitConflict.cases.Fail, TraitConflict.cases.Covered, TraitConflict.cases.Clarification])),
    TraitConflict.cases.Updated,
    Approval.Approval.cases.ApprovalRequired,
    Approval.Approval.cases.RevisionRequired,
    Approval.Approval.cases.Declined,
    S.Void
  ]),
  failure: S.Union([AiError.AiError, TraitStoreError, McpSchema.ElicitationDeclined]),
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
    const proposal = params.proposedTrait
    const results = yield* Effect.forEach(traits, (trait) => check(trait, proposal), { concurrency: "unbounded" })
    const failures = Array.filter(results, TraitConflict.guards.Fail)
    if (failures.length > 0) return failures

    const clarifications = Array.filter(results, TraitConflict.guards.Clarification)
    const covered = Array.filter(results, TraitConflict.guards.Covered)
    if (covered.length > 0) return covered
    if (clarifications.length > 1) return clarifications
    if (clarifications.length === 1) {
      const target = Array.getUnsafe(clarifications, 0).trait
      const approval = yield* Approval.request({
        message: Array.join(
          [`Clarify trait ${target.id}?`, "Current body:", target.body, "Replacement body:", params.proposedTrait],
          "\n\n"
        ),
        approved: params.approved
      })
      if (!Approval.Approval.guards.Approved(approval)) return approval
      const trait = Trait.make({ id: target.id, body: params.proposedTrait })
      yield* store.update(trait)
      return TraitConflict.cases.Updated.make({ trait })
    }

    const approval = yield* Approval.request({
      message: `Save this reusable trait?\n\n${params.proposedTrait}`,
      approved: params.approved
    })
    if (!Approval.Approval.guards.Approved(approval)) return approval
    yield* store.add(params.proposedTrait)
    return
  })
})
