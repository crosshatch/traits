export interface LifecycleStep {
  readonly title: string
  readonly heading: string
  readonly description: string
  readonly note: string
  readonly visual: "feedback" | "draft" | "compare" | "approve" | "save" | "review" | "correct"
}

export const steps: ReadonlyArray<LifecycleStep> = [
  {
    title: "Feedback",
    heading: "Tell the agent what you prefer.",
    description: "Give a correction once so the agent can learn from it next time.",
    note: "Keep lasting preferences, not one-off requests.",
    visual: "feedback"
  },
  {
    title: "Draft",
    heading: "The agent turns your feedback into a clearly-articulated insight.",
    description: "This insight is presented to you as a prompt or elicitation",
    note: "A trait says what you prefer and when it applies.",
    visual: "draft"
  },
  {
    title: "Reconcile",
    heading: "Resolve any inconsistencies",
    description:
      "If the new trait conflicts with any existing traits, the agent decomposes the two and proposes a path for reconciliation.",
    note: "No duplicate traits. No changes without your approval.",
    visual: "compare"
  },
  {
    title: "Approve",
    heading: "You decide what the agent should remember.",
    description:
      "Read the proposed trait. Approve it, ask for different wording, or skip it. If it replaces an existing trait, you see what will change.",
    note: "You can accept a code fix without saving a preference.",
    visual: "approve"
  },
  {
    title: "Save",
    heading: "Carry the lesson into your next session.",
    description:
      "Your approved trait stays with the project, so future agent sessions can follow it without you repeating the correction.",
    note: "Traits are readable Markdown files you can review and version.",
    visual: "save"
  },
  {
    title: "Review",
    heading: "Catch the same mistake in new code.",
    description:
      "As the agent writes code, it checks for missed preferences—like another manual _tag comparison where you wanted a case guard.",
    note: "Findings need a closer look; not every flag is a mistake.",
    visual: "review"
  },
  {
    title: "Correct",
    heading: "Get the fix, not just a warning.",
    description:
      "The agent confirms the mistake, switches the filter to Outcome.guards.Fail, and checks the fix before finishing.",
    note: "Your feedback becomes a habit, not a recurring correction.",
    visual: "correct"
  }
]
