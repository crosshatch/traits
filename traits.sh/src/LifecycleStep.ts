export interface LifecycleStep {
  readonly title: string
  readonly heading: string
  readonly description: string
  readonly note: string
  readonly visual: "feedback" | "remember" | "review" | "correct"
}

export const steps: ReadonlyArray<LifecycleStep> = [
  {
    title: "Feedback",
    heading: "Tell the agent what you prefer.",
    description: "Each correction is an opportunity to communicate your preferences for future codegen.",
    note: "No more one-off requests. Keep lasting preferences.",
    visual: "feedback"
  },
  {
    title: "Remember",
    heading: "You decide what the agent should remember.",
    description:
      "The agent proposes a trait and reconciles conflicts if needed. Approve it, edit it, or skip it. Only approved traits are saved with your project for future sessions.",
    note: "Traits are readable, versionable Markdown. You approve any changes to existing traits.",
    visual: "remember"
  },
  {
    title: "Review",
    heading: "Catch the same mistake in new code.",
    description:
      "As the agent writes code, it checks for missed preferences against established traits, such as another manual _tag comparison where you wanted a case guard.",
    note: "Review the flags and approve changes where relevant.",
    visual: "review"
  },
  {
    title: "Correct",
    heading: "Get the fix, every time.",
    description:
      "The agent confirms the mistake, switches the filter to Outcome.guards.Fail, and checks the fix before finishing.",
    note: "Your feedback guards the quality of codegen.",
    visual: "correct"
  }
]
