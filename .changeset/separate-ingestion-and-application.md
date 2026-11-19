---
"traits": patch
---

Separate trait persistence from application. `add` and `pull` ingest by default;
`--apply` composes a follow-up application, and `traits apply` retries
application without importing again. Remove the phased `--interactive` workflow.

The store returns installed/changed/removed traits and created environments.
Local edits produce an actionable error; `--force` expresses the caller's
overwrite decision. Agent questions return `InputRequired` instead of being
answered by another model; CLI callers exit 2. Configure `agent.sessionPrefix`
(for example `ses_` for OpenCode) instead of relying on an implicit client
format.
