---
"traits": patch
---

Index Markdown traits in a disposable local libSQL database through Drizzle's
Effect driver, with startup schema push and database-only runtime reads.

Populate the fresh index during project initialization and automatically
synchronize external Markdown edits and approved schema repairs with a scoped,
debounced directory watcher. Rebuilds validate all files before transactionally
replacing rows. Mutations perform explicit SQL insert/update/delete alongside
atomic Markdown publication and finish write-through before returning. Dirty or
failed synchronization is retried before reads; clean reads use SQLite only.
Watcher failures are reported and retried without a model-facing refresh tool.

Allow `decisionConcurrency: "unbounded"` to disable the decision request limit.

Reject a second MCP server for the same canonical trait directory using an
OS-backed SQLite ownership lock, automatically released on process exit.

Return unexpected handler failures and defects as declared MCP tool errors while
preserving domain recovery messages and cancellation. Use a single declared
tool-error envelope instead of separately classifying and encoding domain
errors.

Omit absent optional fields when reconstructing cached traits so MCP findings
remain JSON-compatible instead of failing structured-result serialization.

Scope post-save reviews to the current task, document checkpoint-based
verification, and reuse unchanged pending approval assessments while requiring
fresh consent after proposal or store changes.

Resolve project paths once and inject them into storage, locking, and
configuration so subdirectory launches use the correct worktree root.

Consolidate advisory guidance into Markdown context, removing the separate
domain/tool/database field. Reject outdated frontmatter for consent-based
migration instead of silently converting legacy guidance on read.

Use bounded repository decision concurrency and preserve native transport-error
diagnostics before AI-provider error conversion.

Use Effect's standard cause formatting and source-level Redacted values instead
of custom recursive diagnostic formatting and heuristic secret scrubbing.

Recognize reasoned, exact-name trait exceptions in leading single-line HTML
comments as well as line-comment headers, while rejecting malformed or late
directives.
