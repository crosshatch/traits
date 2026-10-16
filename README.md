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
name: direct-callbacks
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

## Incremental coverage

Configure `TraitsConfig.includes` with the complete owned source, configuration
and documentation scope. Checks fail if scope is missing or matches no eligible
files. Do not include secrets, generated output, dependencies or reference code.

Each `check_traits` call discovers the configured files and all stored traits,
but only missing assessment pairs call the model. A changed chunk needs all
traits; a new or revised trait needs all chunks. Identical pairs reuse persisted
assessments in `.agents/assessments/`. Cached violations remain visible;
inconclusive assessments and failed model calls are retried. Cache identities
include trait bodies, source text/location and an evaluator revision. Changes to
`traits.ts` also invalidate assessments. Use `trash .agents/assessments` to
force a new baseline after other model or evaluator changes.

`include` adds files rather than narrowing configured scope. `traitIds` remains
accepted for compatibility but no longer limits coverage or returned findings.
Trait creation, updates and reconciliation automatically run the same coverage
pass and return findings. If assessment fails after saving, inspect the saved
traits and retry `check_traits`, not the mutation.

The first pass needs a cold baseline because historical tool calls did not save
assessment coverage. Approve that cost explicitly with `establishBaseline: true`
on `check_traits`; until then, checks and trait mutation fail with
`CoverageBaselineRequired`. The approval marker records cost consent, not a
successful or compliant review. Subsequent passes reuse assessments. Reviews
still need to be invoked after code edits; this is not a filesystem watcher, CI
gate, or a guarantee that model classifications are correct.

## Local diagnostics

Traits includes [tracewick](tracewick/README.md), a reusable Effect-based local
OTLP collector and query utility. Logs and traces stay in `.agents/otel/` within
the current worktree. Query them with the embedded `otel_*` tools.

The Traits launcher already uses tracewick to capture server startup stderr and
provide the OTLP endpoint through the environment. An independent
`tracewick mcp` connection or the CLI can inspect evidence even when the
application server cannot start. The standalone tracewick launcher also works
with any CLI command that already exports OTEL telemetry.
