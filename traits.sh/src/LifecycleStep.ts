import { String } from "effect"

export interface LifecycleStep {
  readonly title: string
  readonly heading: string
  readonly description: string
  readonly note: string
  readonly filename: string
  readonly code: string
}

export const steps: ReadonlyArray<LifecycleStep> = [
  {
    title: "Notice",
    heading: "A useful correction is a seed.",
    description: "A user points out a better way to work. Look for a trait that will matter beyond this one change.",
    note: "A passing thought need not become a permanent trait. Keep the durable insight; leave the conversation behind.",
    filename: "a conversation",
    code: String.stripMargin(`
    | “Use the tagged union’s case guard here,
    | rather than comparing the tag yourself.”
    |
    | A local correction.
    | A potentially reusable preference.
    `)
  },
  {
    title: "Draft",
    heading: "Give the insight a precise shape.",
    description:
      "Read existing traits first, then draft a concise, standalone trait. Preserve its scope and exceptions.",
    note: "One independently useful convention per trait. A small example often says more than another paragraph.",
    filename: "the proposed trait",
    code: String.stripMargin(`
    | Use tagged unions’ built-in case guards
    | when filtering cases:
    |
    | Array.filter(Outcome.guards.Fail)
    |
    | not a manual comparison of _tag.
    `)
  },
  {
    title: "Compare",
    heading: "A new trait meets the old ones.",
    description: "derive_trait compares the proposal with every stored trait before choosing what should happen next.",
    note: "Already covered? Reuse it. A clarification keeps the existing ID. Inconclusive comparisons block writes.",
    filename: "MCP · derive_trait",
    code: String.stripMargin(`
    | derive_trait({
    |   proposedTrait:
    |     "Use the provided case guards…"
    | })
    |
    | // Distinct, covered, clarification,
    | // conflict, or inconclusive?
    `)
  },
  {
    title: "Approve",
    heading: "The human stays in the loop.",
    description: "Review the exact proposal in an approval form. Save it, revise the wording, or skip it altogether.",
    note: "OpenCode uses an interactive question fallback. Approval to edit code is not approval to save a new trait.",
    filename: "an explicit choice",
    code: String.stripMargin(`
    | Save this reusable trait?
    |
    | ○ Save trait
    | ○ Revise
    | ○ Skip
    | ✎ Your own feedback
    |
    | No approval. No write.
    `)
  },
  {
    title: "Remember",
    heading: "A plain file, not a hidden memory.",
    description:
      "An approved trait becomes a Markdown file in .agents/traits. The file body describes the trait; its name is its ID.",
    note: "Three friendly words make it recognizable. A UUID keeps it unique. Created returns the saved trait and its ID.",
    filename: ".agents/traits/aurora_adventure_sunbeam-<uuid>.md",
    code: String.stripMargin(`
    | Use tagged unions’ built-in case guards
    | when testing or filtering cases:
    |
    | Array.filter(Outcome.guards.Fail),
    | not a manual comparison of _tag.
    `)
  },
  {
    title: "Review",
    heading: "Let the trait change the work.",
    description:
      "After changing TypeScript, check the relevant files. Inspect findings, fix real violations, and check again.",
    note: "A model judgment is a starting point, not proof. Distinguish violation from missing context and respect exceptions.",
    filename: "MCP · check_traits",
    code: String.stripMargin(`
    | check_traits({
    |   include: ["traits/**/*.ts"]
    | })
    |
    | // Or supply traitIds for a focused review.
    | // Fix confirmed violations, then recheck.
    `)
  }
]
