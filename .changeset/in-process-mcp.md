---
"traits": patch
---

Run the default Traits MCP server directly in the CLI process. Scope the local
collector outside the server and exporters so shutdown flushes telemetry before
closing the collector. Keep external-command execution on `traits run`.
