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
    heading: "You correct how the agent filters a union.",
    description:
      "You ask the agent to use the union’s case guard instead of comparing _tag. That correction can guide future code, not just this one filter.",
    note: "Keep reusable preferences. A one-off request, such as renaming a particular variable, need not become a trait.",
    visual: "feedback"
  },
  {
    title: "Draft",
    heading: "The agent drafts a rule it can reuse.",
    description:
      "The agent reads your saved traits, then turns the correction into a standalone rule: use built-in case guards when testing or filtering tagged unions.",
    note: "Name the behavior and its scope. Keep separate preferences in separate traits.",
    visual: "draft"
  },
  {
    title: "Compare",
    heading: "Check whether you already have this rule.",
    description:
      "The agent submits the draft to derive_trait. The tool compares it with every saved trait to find existing coverage, possible clarifications, and conflicts.",
    note: "Covered rules are reused. Changes require approval; inconclusive comparisons block writes.",
    visual: "compare"
  },
  {
    title: "Approve",
    heading: "You decide what the agent should remember.",
    description:
      "Review the full case-guard rule before it is saved. Approve it, revise its wording or scope, or skip it. Proposed replacements also show the existing traits they affect.",
    note: "Approving a code fix does not approve a new trait. Saving or replacing a trait needs its own explicit approval.",
    visual: "approve"
  },
  {
    title: "Save",
    heading: "Save the approved rule as Markdown.",
    description:
      "After approval, derive_trait writes the rule to .agents/traits and returns its ID. Future agent sessions can read the same file instead of relying on this conversation.",
    note: "You can inspect and version the files. Clarifications preserve an existing trait’s ID rather than adding a duplicate.",
    visual: "save"
  },
  {
    title: "Review",
    heading: "Check new code against your saved rules.",
    description:
      "After editing src/Outcome.ts, the agent calls check_traits on that file. The model reviews its current contents against your traits and flags code that may still compare _tag manually.",
    note: "Check changed files, not dependencies or secrets. Read each finding in context; a model judgment is not proof.",
    visual: "review"
  },
  {
    title: "Correct",
    heading: "Replace the comparison, then check again.",
    description:
      "The agent confirms that the finding applies, replaces the manual filter with Outcome.guards.Fail, and reruns check_traits plus the relevant project checks.",
    note: "Fix confirmed violations. Reject irrelevant findings, respect exceptions, and investigate missing context rather than changing correct code.",
    visual: "correct"
  }
]
