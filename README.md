# Traits

Your coding agent learns from your feedback—and remembers.

Tell it what you prefer once. Traits turns reusable feedback into coding
preferences that carry into the next task, session, and generation of code.

- **Learn:** the agent proposes a trait from your feedback.
- **Remember:** it compares existing traits and asks you to approve changes.
- **Apply:** it reviews new code against your preferences and corrects
  violations.

## Your preferences, in plain text

Traits live as readable Markdown in `.agents/traits/<name>.md`, alongside your
project. Each descriptive name is unique and identifies the trait:

```markdown
---
name: direct-callbacks
subject: Callbacks passed to functions.
requirement: >
  Pass compatible functions directly instead of wrapping them in forwarding
  arrows.
purpose: Expose callback behavior without redundant wrappers.
---
```

Review them, edit them, and share them with your team. You approve what gets
remembered—including changes to existing preferences.

Traits use a fixed, domain-neutral vocabulary: required `name`, `subject`,
`requirement`, and `purpose`; optional natural-language `applicability` and
`guidance`. The optional Markdown body provides supporting `context`, including
examples and references. Additional frontmatter keys are rejected. Guidance
never grants permission to act. Older traits require explicit migration to these
fields; parse errors provide guidance and never rewrite files automatically.

## Two tools

Traits connects to your coding agent through MCP:

- **`derive_trait`** proposes, compares, and saves preferences with your
  approval. Pass a complete trait object as `proposedTrait`.
- **`check_traits`** reviews code against the saved traits.

`check_traits` remains a file-based adapter. Its optional `circumstances` text
supplies the triggering task, workflow stage, or surrounding facts to
assessment. The SDK's `evaluateAll` also accepts arbitrary text through
`Source`, with optional circumstances; the trait format itself is not restricted
to code.

Model assessments are guidance, not guarantees. The agent reviews findings,
fixes confirmed violations, and checks again.

## Get started

Paste this into your coding agent inside your project:

> Set up Traits using https://github.com/crosshatch/traits/blob/main/SETUP.md.
> Follow this project's conventions, ask me to choose providers and models, and
> preserve existing configuration.

Your agent handles setup. You choose the models and supply credentials
privately.

[Explore Traits](https://traits.sh) · [Setup guide](SETUP.md)
