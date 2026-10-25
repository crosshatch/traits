# Reflection

```sh
traits run --id worker 'node script.ts'
traits run --id worker -- node script.ts --some-flag
traits reflection
```

`run` requires a nonblank section ID. The quoted command uses a shell; arguments
after `--` execute directly. Stdio, child exit codes, signals, and shutdown-time
exporter flushing are preserved. Bare `traits` runs the instrumented MCP server.
`run` and `reflection` do not load model configuration or install project
dependencies. Configure `traits reflection` as a separate stdio MCP server in
your agent. It exposes only `query`, accepting a `sql` string and returning JSON
rows; the trait-management tools remain on the main Traits server. SQL failures
are MCP tool errors, and the server remains available for subsequent calls.

## Exporting

Use Effect's standard JSON exporters in the child:

```ts
import { Layer } from "effect"
import { FetchHttpClient } from "effect/http"
import { OtlpLogger, OtlpSerialization, OtlpTracer } from "effect/observability"

const telemetry = Layer.mergeAll(
  OtlpTracer.layerFromConfig(),
  OtlpLogger.layerFromConfig()
).pipe(Layer.provide([FetchHttpClient.layer, OtlpSerialization.layerJson]))
```

Provide this layer to the child's program. Close its scope normally to flush.
The wrapper supplies standard OTLP endpoint/exporter variables and `http/json`
protocol settings. It does not automatically instrument the child. Explicit
`OTEL_SERVICE_NAME` values are preserved.

The local receiver accepts JSON at `/v1/traces` and `/v1/logs`, including gzip.
Both received and decompressed bodies are limited to 16 MiB. Protobuf
receives 415. Invalid JSON/record shapes receive 400. Each request is committed
atomically; database write errors receive retryable 503 responses. Retries may
duplicate data.

## SQL storage

The shared database is `.reflection/reflection.sqlite` at the worktree root, or
the launch directory outside Git. Concurrent runs use WAL and distinct run IDs.

- `runs`: execution metadata, sectionId, command, cwd, startedAt/endedAt, exit
  code.
- `spans`: one row per span, runId, receivedAt, traceId, spanId, parentSpanId,
  name, startTimeUnixNano, endTimeUnixNano, statusCode.
- `logs`: one row per log, runId, receivedAt, traceId, spanId, timeUnixNano,
  observedTimeUnixNano, severityNumber, severityText.
- `traits`: the Markdown-derived trait index.

Both telemetry tables retain full `record`, `resource`, and `scope` JSON text,
including unknown record fields, plus resourceSchemaUrl and scopeSchemaUrl.
Nanosecond timestamps remain decimal text; receivedAt is epoch milliseconds. IDs
are indexed in lowercase; original record values are preserved. SQL returns raw
rows as a JSON array, with JSON columns remaining strings. Use json_extract for
projections, SQL joins for correlation, and explicit ORDER BY/LIMIT clauses.

Example `query` arguments:

```json
{
  "sql": "SELECT runs.sectionId, json_extract(logs.record, '$.body.stringValue') AS message FROM logs JOIN runs ON logs.runId = runs.id WHERE logs.severityNumber >= 17 ORDER BY logs.receivedAt DESC LIMIT 50"
}
```

```json
{
  "sql": "SELECT name, (CAST(endTimeUnixNano AS INTEGER) - CAST(startTimeUnixNano AS INTEGER)) / 1000000.0 AS durationMs FROM spans ORDER BY durationMs DESC LIMIT 20"
}
```

The legacy `exports` table is retained to preserve pre-existing batches, but is
no longer populated or decoded. Historical protobuf batches are not migrated
into spans/logs. New installations also include this compatibility table. No
retention policy is applied. Add `.reflection/` to Git ignore rules.
