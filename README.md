# Traits

Your coding agent learns from your feedback—and remembers.

Tell it what you prefer once. Traits turns reusable feedback into coding
preferences that carry into the next task, session, and generation of code.

- **Learn:** the agent proposes a trait from your feedback.
- **Remember:** it compares existing traits and asks you to approve changes.
- **Apply:** it reviews new code against your preferences and corrects
  violations.

## Your preferences, in plain text

Traits live as readable Markdown in `.agents/traits`, alongside your project:

```markdown
---
id: 91f2990f-cdc0-4a1c-9a10-b0939e4de481
name: direct_callbacks
when: passing callbacks.
---

Pass compatible functions directly instead of wrapping them in forwarding
arrows.
```

Review them, edit them, and share them with your team. You approve what gets
remembered—including changes to existing preferences.

## Two tools

Traits connects to your coding agent through MCP:

- **`derive_trait`** proposes, compares, and saves preferences with your
  approval.
- **`check_traits`** reviews code against the saved traits.

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
