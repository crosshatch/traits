# Traits

**Reusable preferences for your AI agent.**

[![npm](https://img.shields.io/npm/v/traits?style=flat-square&color=6D5BD0&label=traits)](https://www.npmjs.com/package/traits)
[![license](https://img.shields.io/badge/license-Apache%202.0-6D5BD0?style=flat-square)](https://github.com/crosshatch/traits/blob/main/LICENSE)
[![discord](https://img.shields.io/badge/discord-join-6D5BD0?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/CSXCRUKjh9)

Traits turns feedback into preferences your agent can use across tasks and
sessions. Each trait is a Markdown file in `.agents/traits/<name>.md`:

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

Your agent proposes traits, asks you to approve changes, and checks its work
against them through MCP. The files live in your project, so you can edit,
review, and share them with your team.

The MCP server indexes traits in a disposable local libSQL database using
Drizzle and its Effect driver. Each server starts with a fresh database, applies
the schema through drizzle-kit's programmatic push, and indexes Markdown during
project initialization. Reads reconcile content hashes and only reparse changed
traits; each trait field, including its Markdown body (`context`), has its own
table column. Tool writes update both Markdown and the index. External edits and
deletions are picked up on the next access. Markdown remains authoritative, and
invalid files report errors instead of serving stale indexed content. Each
server owns its temporary database, which is cleaned up when its scope closes.
Vector search is not enabled.

Only one Traits MCP server may own a trait directory at a time. Startup acquires
an OS-backed SQLite write lock before creating the disposable index. Another
server targeting the same directory (including a symlink alias) exits with a
diagnostic naming that directory; separate worktrees can run independently. The
lock database at `.agents/traits/.mcp-lock/owner.db` is automatically
Git-ignored and remains on disk. Do not delete it while servers are running:
ownership is the live OS lock, not the file's presence. The lock releases on
normal shutdown or process termination, including a crash. SDK users composing
their own stores are responsible for equivalent ownership enforcement.

Project paths are resolved once from the Git worktree root before configuration
and lock initialization. The lock, stores, and configuration loader consume
`ProjectPaths`; SDK callers can inject `{ projectRoot, traitsDirectory }` using
`Layer.succeed(ProjectPaths.ProjectPaths, paths)` at their composition boundary.
Launching from a project subdirectory uses the same root trait directory.

Successful tool mutations finish updating the index before returning. Writes
publish complete Markdown files, and cancellation waits for write-through to
finish. Filesystem and database writes are not a single transaction: if indexing
fails after publication, the operation reports failure and later reads reconcile
from Markdown. External file edits are reconciled on the next store access, not
continuously in the background. Invalid traits encountered at startup are
reported and can be repaired and retried through the tools without restarting.

Set `decisionConcurrency` in `traits.ts` to a positive integer or `"unbounded"`
to remove the application-level decision request limit. The default is `4`;
provider rate limits still apply. Bounded concurrency also limits simultaneous
connection attempts: unbounded request bursts can fail at the network layer even
without provider rate limits. Transport diagnostics retain native
connection-error codes before provider error conversion, without dumping HTTP
headers or request bodies.

Tool failures are returned to the MCP client with `isError: true`. Known domain
errors, unexpected handler failures, and defects return `ToolExecutionError`
with domain recovery messages and standard Effect cause diagnostics. The MCP
toolkit owns success-schema encoding and reporting of output-encoding failures.
Wrap secrets in `Redacted` at their source; diagnostics do not apply heuristic
secret-pattern scrubbing. The transport adapter copies only native connection
codes and messages, not HTTP headers or request bodies. Inspect arbitrary error
messages before sharing them. A failed check is incomplete, and a failed
mutation may have written traits before failing; inspect the store before
retrying.

Saving a preference triggers review of files changed or directly involved in the
current task, not an automatic repository-wide audit. Exact unchanged reviews
can be reused. Retroactive audits are explicit, and verification is grouped into
focused checks and meaningful completion checkpoints. An approval retry can
reuse a pending relationship assessment only when the complete proposal and full
trait-store snapshot are unchanged; otherwise it reassesses and requests fresh
consent. This cache is process-local, holds one pending assessment per store,
and never authorizes a write on its own.

Each trait requires `name`, `subject`, `requirement`, and `purpose`.
`applicability` is optional; the Markdown body holds supporting context,
advisory guidance, examples, and references. There is no separate `guidance`
field. Unsupported frontmatter keys, including legacy `guidance`, are rejected
and use the consent-based schema-error recovery workflow. Advisory content does
not grant permission to act, and model assessments are not guarantees.

## Get started

Paste this into your agent inside your project:

```text
Set up Traits using https://github.com/crosshatch/traits/blob/main/SETUP.md.
Follow this project's conventions, ask me to choose providers and models, and
preserve existing configuration.
```

## License

[Apache-2.0](https://github.com/crosshatch/traits/blob/main/LICENSE)
