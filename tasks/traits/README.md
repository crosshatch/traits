# Traits

A project-local MCP server run with `pnpm run tasks traits`. OpenCode starts it
with `node tasks/main.ts traits` through `opencode.json`.

## Configuration

Set `TYPESAFE_API_KEY` in the repository root `.env`, worktree `.env`, or MCP
process environment. Configuration is loaded at CLI startup, with precedence:
process environment, worktree `.env`, main repository `.env`. Credentials are
not copied into worktrees. Restart the MCP process after changing configuration,
including dotenv settings.

The root `traits.ts` selects `jev-latest` directly. Its optional `passThreshold`
defaults to `0.90` and must be finite and within `[0, 1]`. These settings
configure local tooling, not deployment or CI.

## Workflow

The agent previews the trait filename and full text and gets approval before
calling `create-trait`. An explicit request supplying the exact name and text
counts as approval. Revision feedback requires a new preview and approval.

Before saving, Jev compares the proposal against every existing trait in
parallel. Each comparison must select `distinct` with probability at least the
configured threshold. Otherwise, `reconciliation-required` returns the relevant
existing traits and probabilities without writing. The agent proposes reuse,
clarified scopes, or a merge, shows full text and any removals, and asks for
approval using an interactive question when available. It never silently edits
existing traits.

Comparison failures, native filesystem errors, and configuration errors
propagate; the agent should explain missing configuration and ask the user to
supply it. Names and content are plain strings.

Successful creation writes `.agents/traits/<name>.md` exclusively and
automatically reviews the new trait against the agent-selected `target`. Both
tools require an explicit target: `Staged`, `Unstaged`, `Untracked`, `Changed`,
`Dirs` (with `dirs: string[]`), or `Files` (with `files: string[]`), tagged with
`_tag`. Use `{ _tag: "Dirs", dirs: ["."] }` to review the whole repository. The
returned `reviews` array has one entry containing the target and a report or
error. Review failure does not undo creation. Traits apply immediately,
including unstaged trait files.

Before committing, stage intended changes and call `check-traits`, which reviews
**staged changes only**. Fix findings and rerun after changing the index.

## Review input and results

Git produces the input directly:

| Section     | Source                                                               |
| ----------- | -------------------------------------------------------------------- |
| `staged`    | `git diff --cached --no-color --no-ext-diff --no-textconv`           |
| `unstaged`  | `git diff --no-color --no-ext-diff --no-textconv`                    |
| `untracked` | `git ls-files --others --exclude-standard -z`, then FileSystem reads |

Git returns `{ path, content }` entries with labelled per-file patches or new
file contents. Renames become deletion/addition. All-change reviews retain both
staged and unstaged entries for the same path. Each decision receives one change
and one trait. Git runs through Effect's process services. No temporary indexes,
tree objects, snapshot identities, or staleness checks are created.

Each trait/change pair receives one Jev classification, with unbounded
concurrency. Report counts refer to these pairs. There are no local byte budgets
or size-based batches. Decision calls propagate errors naturally, without local
retries, timeouts, or conversion into findings.

Reports contain the root, target, status, nonpassing findings, the number of
trait/change pairs checked, and an optional explanatory message. A pass requires
a compliant/not-applicable label and
`P(compliant) + P(not-applicable) >= threshold`. Inconclusive results and
provider failures are not passes. Non-textual or missing context can make a
review inconclusive; this is a textual review, not a binary-content review.

Findings identify the trait and `changePath`, without line citations. The coding
agent inspects the diff to locate violations. Reports describe the input
captured for that call; the agent must rerun after relevant edits. No Git hook
is installed.

## Verification

Run `pnpm exec vp check` and `pnpm build`. The traits test files were removed;
live provider verification requires `TYPESAFE_API_KEY`.
