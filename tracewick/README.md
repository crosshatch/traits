# Tracewick

Run a command with a local OTLP receiver:

```sh
tracewick run --id worker 'node script.ts'
tracewick run --id pipeline 'node producer.ts | node consumer.ts'
tracewick run --id worker -- node script.ts --some-flag
```

`--id` is required and must not be blank. Use a stable section ID for each
script; repeated invocations may reuse it while retaining unique run IDs. Supply
it before `--` when using direct execution.

The quoted form uses the system shell. Arguments after `--` execute directly,
without shell expansion. Stdin, stdout, and stderr are inherited. Tracewick
preserves child exit codes and forwards SIGINT, SIGTERM, and SIGHUP to its
process group, keeping ingestion available while the child shuts down.

## Exporting from Effect

Use Effect's standard layers in the child:

```ts
import { Layer } from "effect"
import { FetchHttpClient } from "effect/http"
import { OtlpLogger, OtlpSerialization, OtlpTracer } from "effect/observability"

const telemetry = Layer.mergeAll(
  OtlpTracer.layerFromConfig(),
  OtlpLogger.layerFromConfig()
).pipe(Layer.provide([FetchHttpClient.layer, OtlpSerialization.layerProtobuf]))
```

Provide `telemetry` to the child's program. JSON serialization also works. Close
the program's Effect scope normally to flush batched spans and logs.

Tracewick injects the standard OTLP base URL, signal-specific traces/logs URLs,
`http/protobuf` protocol settings, and `otlp` exporter selection. Explicit
`OTEL_SERVICE_NAME` values are retained; otherwise it supplies a default. It
does not install instrumentation into the child automatically.

## Inspecting telemetry

```sh
tracewick runs --id worker
tracewick traces --id worker --errors
tracewick logs --id worker --search timeout
tracewick traces --run <run-id> --trace <trace-id> --json
tracewick logs --trace <trace-id> --json
tracewick logs --since 2026-10-23T12:00:00Z --until 2026-10-23T13:00:00Z --limit 100
```

`runs` lists executions. `traces` lists individual spans; use `--trace` to
inspect all matching spans or correlated logs. Section IDs and run IDs match
exactly; trace IDs are case-insensitive, full 32-digit hexadecimal IDs.
`--search` is a case-insensitive literal substring search across record,
resource, and scope JSON, including messages, span names, and attributes.
Filters combine with AND. `--errors` selects spans with error status or logs at
ERROR/FATAL severity.

Results default to 50 matches (`--limit 1` through `--limit 1000`). Runs are
ordered by start time, newest first. Telemetry is ordered by ingestion: newest
export first, then last record first within each export. `--since` and `--until`
are inclusive bounds on run start time or telemetry receive time, not the
exported event timestamps. The limit applies after record-level filtering.

Default output is a tab-separated summary. `--json` emits a JSON array with full
records, resource/scope metadata, schema URLs, run/section IDs, and export ID
plus record index. Protobuf IDs are rendered as hexadecimal and 64-bit values
remain decimal strings. Empty results emit `[]` in JSON mode. A missing database
is initialized automatically and queries return empty results. Malformed stored
exports report their export ID.

Metadata filters use Drizzle queries against the existing tables. Trace, text,
and error filters decode the selected batches in pages; no additional index or
copy of the telemetry is maintained.

## Storage and protocol

Each run binds `127.0.0.1` on an available port and accepts OTLP/HTTP JSON and
protobuf at `/v1/traces` and `/v1/logs`. Identity and gzip bodies are supported,
with a 16 MiB limit for both received and decompressed bodies. Successful
requests are acknowledged only after SQLite commits them. Malformed payloads
receive 400, unsupported encodings receive 415, and database write failures
receive retryable 503 responses.

The database is `<worktree-root>/.tracewick/tracewick.sqlite`, falling back to
the current directory outside Git. Concurrent runs share this database using WAL
and separate run IDs. Add `.tracewick/` to the consuming repository's ignore
rules.

`runs` records the indexed `sectionId`, command, directory, timing, and exit
information. Runs stored before section IDs were introduced retain a null
`sectionId`. `exports` stores each complete, decompressed OTLP request as a BLOB
with its run ID, signal, media type, and receive time. Original JSON/protobuf
bytes preserve timestamp precision, resource/scope metadata, and unknown fields.
Retries may produce duplicate batches, consistent with OTLP's at-least-once
delivery model. Data remains on disk after the process exits; retention is
future work.

## Development

From the workspace root:

```sh
pnpm build
pnpm exec tracewick run --id worker -- node script.ts
pnpm exec vp test run --project tracewick
```

`descriptor.json` is generated from the official Apache-2.0-licensed
OpenTelemetry protobuf definitions, pinned to v1.11.1. Regenerate it from the
workspace root with `pnpm tasks generate-proto`. The current OpenTelemetry JS
transformer provides exporter serializers, not public request decoders;
Tracewick uses `protobufjs` with this descriptor for decoding rather than
maintaining its own span/log models. Tests also exercise the upstream
OpenTelemetry serializers.
