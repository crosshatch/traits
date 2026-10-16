---
"traits": patch
"tracewick": patch
---

Add tracewick: worktree-local OTLP ingestion, persistent runs/logs/traces,
transparent command supervision with stderr capture, and CLI/MCP query tools.
Integrate the collector and diagnostic toolkit into Traits.

Declare local tables with Drizzle's Effect SQLite driver and initialize them via
headless JavaScript schema push. Refuse version-mismatched telemetry stores
until an explicitly confirmed reset deletes the old telemetry database.

Have the Traits bootstrap supervise its server through tracewick after
dependency installation. Configure the server exporter exclusively with
OTEL_EXPORTER_OTLP_ENDPOINT instead of a CLI flag or automatic collector
fallback.

Expose case-specific tagged diagnostic errors with structured metadata and
preserve their fields and native cause context across collector and MCP
boundaries.
