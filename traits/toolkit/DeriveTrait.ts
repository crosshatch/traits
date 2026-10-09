import { Schema as S, String } from "effect"
import { AiError, DecisionModel, LanguageModel, McpSchema, Tool, Toolkit } from "effect/ai"

import { derive, TraitDerivation } from "../TraitDerivation.ts"
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
  | Inconclusive returns relationship findings and blocks all writes; clarify ambiguity or revise the proposal before retrying.
  | Confirmed conflicts enter reconciliation within this tool. Approval shows affected trait IDs/bodies, removals, the proposal, and replacement policy.
  | Nothing is replaced before approval. After approval, generate compatible standalone replacements, save them, then delete only the conflicting originals.
  | The proposal takes precedence only in direct conflicts; preserve unrelated requirements, scopes, and exceptions. Resolved returns saved replacements.
  | Do not submit the same proposal again after Resolved: it is already incorporated. Inspect replacements and check relevant TypeScript files.
  | Reconciliation is not transactional; on an error, inspect the store before retrying because some writes or removals may have completed.
  | Covered returns the existing traits representing the proposal; reuse them without writing a duplicate.
  | A single clarification candidate is selected automatically for approval; provide a complete replacement body preserving existing requirements and exceptions.
  | Multiple clarification candidates return Clarification with those traits and the proposal without writing. Refine the proposal or clarify intent.
  | The shared approval flow shows the existing and proposed bodies; ask in the client UI only if ApprovalRequired is returned.
  | The tool rechecks all traits before updating, preserving the selected ID. Updated returns the saved trait.
  | Never use approved: true for an unapproved replacement, and never resolve a mere clarification by deleting traits.
  | Created returns the saved trait including its generated ID. Every response is one tagged TraitDerivation outcome, never a bare array or void.
  | Then call check_traits on relevant TypeScript files, using returned trait IDs for focused reviews when appropriate.
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
  success: TraitDerivation,
  failure: S.Union([AiError.AiError, TraitStoreError, McpSchema.ElicitationDeclined]),
  dependencies: [DecisionModel.DecisionModel, LanguageModel.LanguageModel, TraitStore, TraitsContext]
})
  .annotate(Tool.Title, "Derive Trait")
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, true)

export const toolkit = Toolkit.make(DeriveTrait)

export const layer = toolkit.toLayer({
  derive_trait: derive
})
