---
"traits": patch
---

Bundle telemetry ingestion and inspection into the traits package and CLI. Bare
traits starts the instrumented MCP server; run and reflection handle telemetry
without loading model configuration. Use one worktree-local SQLite database and
complete Drizzle schema for trait definitions, runs, spans, and logs, preserving
existing telemetry at its current path. Consolidate telemetry tests into the
Traits suite and remove the standalone telemetry package.
