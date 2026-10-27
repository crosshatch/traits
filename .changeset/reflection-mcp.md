---
"traits": patch
---

Replace the SQL query CLI command with `traits reflection`, a separate stdio MCP
server exposing only the query tool. It accepts SQL and returns JSON rows from
the worktree database without loading trait model configuration.
