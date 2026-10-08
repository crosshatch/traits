---
name: traits
description: >-
  Use when the user corrects your approach or expresses a reusable coding
  preference, even without mentioning traits: propose saving new durable
  insights and ask for approval. Also use when creating or revising traits,
  configuring trait sources, reconciling overlaps, or checking traits before
  committing.
---

# Traits

- Call `list-groups` before proposing a trait. It returns configured names,
  required descriptions, source types and paths without initializing Git
  sources. Choose the most specific description matching the insight; ask the
  user if the destination is ambiguous or no group fits. Do not infer scope from
  names alone. Every source stores top-level `*.md` files at
  `.agents/traits/<group>`. Omitted groups default to a Local `project` group
  described as "Project-specific"; `{}` means none. Read all groups to avoid
  duplicates; they are additive without overrides.
- Git sources use managed submodules. Tools initialize them and reuse a branch
  per project branch/worktree. Registration stages `.gitmodules` and the
  gitlink; inspect them before committing. `pin` instead selects an existing
  remote branch, fetching and fast-forwarding clean checkouts. Preserve local
  edits and resolve blocked switches or divergence without resetting them.
- Treat Git groups as separate repositories. Consult their trait Markdown, but
  exclude their checkouts from unrelated project-wide edits and formatting.
  Exclude `.git` files/directories and the parent's `.git/modules` from content
  searches and edits; a submodule's `.git` is usually a pointer file, not a
  directory. Use `git -C .agents/traits/<group>` for trait commits/pushes and
  `git -C <project-root>` for the consumer. Keep `.gitmodules` and gitlinks
  tracked in the parent; do not flatten submodules, remove their metadata, or
  suppress dirty-submodule status.
- Git publishing is manual unless `auto: true`: creation commits only the newly
  approved trait and pushes the selected branch. Approval must show the remote,
  branch and automatic publication, including in the fallback flow. Check
  `publication.status`: `published` succeeds; `failed` retains the saved file
  and any commit. Resolve the failure without recreating the trait.
  `publication: null` means manual publishing. Direct edits to existing traits
  remain manual; unrelated staged files stay staged. Stage the updated parent
  gitlink after publishing.
- Draft traits concisely: preserve essential rules, scopes, and exceptions; omit
  headings, repetition, and unnecessary explanation or examples. Every word adds
  evaluation cost.
- `create-trait` compares the proposal with every existing trait across all
  groups before writing. On `reconciliation-required`, inspect the returned
  traits and propose reuse, clarified scopes, or a merged replacement, showing
  exact filenames, full text, and any removals. Offer approve/revise/cancel
  using an interactive question when available, otherwise a text question. Apply
  reconciliation edits only after explicit approval. Comparison errors propagate
  before writing; report the blocker. After reconciling existing files, retry
  creation only if a new file is still needed.
- Creation and code review require an explicit target. Choose Staged, Unstaged,
  Untracked, or Changed for changes; `{ _tag: "Files", files: ["path"] }` for
  complete files; or `{ _tag: "Dirs", dirs: ["path"] }` for directories (`["."]`
  for the repository). After `create-trait`, inspect its automatic review of the
  selected target. Findings identify group/trait/file combinations. Review
  errors do not undo the saved trait: report incomplete reviews rather than
  claiming success. Use `{ _tag: "Staged" }` for pre-commit `check-traits`.
- Also use `create-trait` when the user explicitly asks to add a trait or
  describes one they want saved; a prior feedback event is not required. Read
  existing traits first. Call with the destination group, drafted name, full
  text, and review target. The server requests approval of the group, resolved
  path and text through MCP form elicitation before writing; do not ask
  separately first. Use snake_case filenames.
- When the user corrects your approach or expresses a reusable coding
  preference, proactively consider capturing it; do not wait for the user to
  mention traits. Read traits across all configured groups to avoid duplicates.
  Propose only durable insights that are not already covered, rather than
  one-off task requirements. Call `create-trait` to present the proposal for
  approval. For `revision-required`, rewrite using the returned feedback and
  call again for approval. For `declined` or cancellation, stop; no trait is
  saved.
- OpenCode uses in-chat fallback approval because its MCP forms are routed to
  the global session. Other clients use native forms when supported.
- For `approval-required`, the client lacks usable form elicitation. Show the
  destination group, exact path and full text and ask approve/revise/cancel
  using an interactive question when available, otherwise text. Retry with
  `approved: true` only after approval of that exact proposal. An explicit
  request supplying the exact group, path and text counts as approval for this
  fallback. This flag never bypasses elicitation on clients with usable forms.
  Never retry while revision or approval is pending.
- Before committing, stage the intended changes and call the traits MCP
  `check-traits` tool. Current trait files apply immediately, even if unstaged.
  Investigate nonpassing traits using the reported probabilities and the Git
  diff. Fix, restage, and rerun. Inconclusive results are not passes. Changing
  staged code or traits requires another check. If there are no traits or no
  changes, report that explicitly.
- Before a consumer commit or PR, run `traits precommit`. Git-source traits must
  be clean, their HEAD published in the configured repository, and the staged
  parent gitlinks must match. With `pin`, both checkout and publication must use
  that branch. Publish any pending trait changes in their own repositories, then
  stage the parent gitlinks and rerun. Do not bypass a failure or describe a
  code-compliance pass as a publication pass. This command does not require
  model credentials and does not mutate repositories. If remote history is
  unavailable locally, fetch and retry. For project-scoped branches, complete
  the traits-repo PR before merging the consumer PR and update its gitlink to
  the accepted commit. Pinned branches follow the shared repo's
  direct-push/review policy. Publication checks do not certify review approval.
- Discover these tools under the `traits` server in Code Mode; their native
  names are `traits_list-groups`, `traits_create-trait` and
  `traits_check-traits`.
