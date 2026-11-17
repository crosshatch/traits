---
name: nonredundant-mcp-instructions
subject: MCP tool descriptions and shared server instructions.
assertion: Consolidate shared behavioral guidance rather than repeating full
  workflows in every tool description. Keep tool descriptions focused on
  invocation and outcome handling, and provide exceptional recovery details with
  relevant errors/results. Preserve approval requirements, scope restrictions,
  outcome interpretation, and remediation/recovery obligations when shortening
  text.
purpose: Reduce MCP context overhead without losing meaningful agent guidance.
---

Not a violation: one sentence in a tool description saying when to call that tool, even when the server instructions say it too, because some clients do not show server instructions.

Violation: recovery steps in a tool description that the failure message already returns, such as "If the check fails ... run `traits update`".

Not a violation: a description's opening statement of what the tool does and which input qualifies; guidance that maps a workflow step to arguments ("pass all their paths in one call and omit traits"); how to read each result; one sentence guarding an approval requirement ("Never write trait files yourself to bypass this tool").
