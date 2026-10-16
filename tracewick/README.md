# tracewick

Local OTLP ingestion and agent-friendly queries, built with Effect. Requires
Node 24 or newer. No UI, cloud service, MCP gateway, or automatic issue
creation.

## Run a command

```sh
tracewick --run integration-tests -- pnpm test
tracewick --run server -- node server.js
tracewick --project /path/to/worktree -- python script.py
```

The supervisor owns the command, inherits stdin/stdout, forwards stderr
unchanged, and captures stderr plus process lifecycle diagnostics. Every
invocation has a unique run ID; `--run` supplies a repeatable display name. The
child command keeps its original working directory; `--project` selects
telemetry storage.

Traits already uses this supervisor in its standard launcher; it does not need
another tracewick wrapper.

The child receives run-specific `OTEL_EXPORTER_OTLP_ENDPOINT`, traces/logs
endpoints, traces/logs HTTP-protobuf protocol settings, and `TRACEWICK_RUN_ID`.
Signal-specific endpoints intentionally override inherited export destinations.
Metrics configuration is untouched. **Environment variables configure an
existing OTEL SDK; they do not instrument an application or install an
exporter.** Explicit SDK configuration or an OTEL configuration file may
override environment settings.

An application using OTLP/HTTP JSON can use the same endpoints. Traits already
has a JSON exporter and consumes the base endpoint automatically. There is no
gRPC or metrics receiver.

## Query after exit

```sh
tracewick status
tracewick runs --query '{"name":"integration-tests"}'
tracewick logs --query '{"runId":"<id>","limit":30}'
tracewick traces --query '{"service":"my-server","errors":true}'
tracewick trace --query '{"traceId":"<id>"}'
tracewick span --query '{"traceId":"<id>","spanId":"<id>"}'
```

Queries default to the current Git worktree (including from subdirectories).
Outside Git, the selected directory is the capture group. Use `--project` to
select another directory. Runs, traces and logs support bounded pages; pass
`nextCursor` back as `cursor` with the same filters. Timestamps in query filters
are Unix milliseconds; original OTEL nanosecond strings remain in span/log data.
Trace detail is paginated spans with parent IDs, not a falsely complete tree.

Filter fields are defined in `contracts.ts`: run, service, trace/span ID, text,
time bounds, minimum severity, error status, duration, and exact attribute
values. Log searches return compact previews; use `includeData: true` to
retrieve full structured payloads when needed. Trace searches return summaries
of **matching spans**, not all spans in the trace. Captured stderr has synthetic
ERROR severity because it is useful for startup debugging; applications also
write benign diagnostics to stderr.

## MCP clients

Register two independent MCP commands with the **same working directory**:

```text
application: tracewick --run server -- npx some-mcp-server
diagnostics: tracewick mcp
```

The launcher is protocol-transparent: it does not add tools, inspect MCP
traffic, or answer requests for a failed child. Query the independent
diagnostics server or CLI when the application cannot initialize. The
diagnostics server exposes `otel_status`, `otel_list_runs`, `otel_get_run`,
`otel_search_traces`, `otel_get_trace`, `otel_get_span`, and `otel_search_logs`.

## Embed in Effect MCP servers

```ts
import { Layer } from "effect"
import * as Tracewick from "tracewick/mcp"

// Merge alongside your existing McpServer.toolkit layer.
const toolLayers = Layer.mergeAll(yourToolLayer, Tracewick.layer())
```

Provide the usual platform services and `HttpClient` (for example
`NodeServices.layer` and `FetchHttpClient.layer`). `tracewick/Queries` exports
the `Queries` service/layer; `tracewick/mcp` also exports the toolkit and
handler layer for custom service implementations. `tracewick/client` exports
Effect operations for discovery/query integration. `tracewick/launcher` exports
`runCommand`, the same supervisor used by the CLI, for launching a child
directly from an Effect application without a second CLI wrapper process.

## HTTP API definitions

`tracewick/Api` exports the shared Effect HttpApi definition for health, control
and OTLP endpoints. The collector uses HttpApiBuilder for routing, path
parameter validation and JSON/protobuf payload decoding; consumers can generate
a typed client with `HttpApiClient.make(Api, { baseUrl: endpoint })` from
`effect/http-api`. Bounded gzip transport handling and the OTLP protobuf wire
codecs remain explicit so compressed payload limits and OTLP responses are
preserved.

## Structured failures

Application failures use case-specific tagged errors exported from
`tracewick/errors` (and the package root). For example,
`CollectorIdentityMismatch` carries the discovery file plus expected and
observed collector identities; `CollectorHttpFailure` carries the endpoint,
method, path, status, raw response body and parsed response. Validation and
ingestion failures have their own tags and relevant parameters/limits.

Native Effect filesystem, HTTP and schema errors retain their existing
structured context. MCP failures and collector JSON error responses preserve
`_tag`, diagnostic properties, messages, stacks and cause chains rather than
flattening them into a message-only error. JSON formatting redacts supported
redactable values and drops cyclic/non-serializable references; it does not
promise lossless JavaScript object round-tripping. A live collector
identity/health defect is surfaced, not silently treated as a missing collector.
Captured process-failure logs also retain structured `data.details`; query logs
with `includeData: true` to inspect those fields alongside the readable stderr.

## Other languages / MCP frameworks

The collector's versioned HTTP contract is the integration boundary; no Effect
runtime is required in the consumer. Discover its URL from
`.agents/otel/collector.json`, validate it with `GET /health`, then:

```python
import json
import urllib.request
from pathlib import Path

collector = json.loads(Path(".agents/otel/collector.json").read_text())
request = urllib.request.Request(
    collector["endpoint"] + "/api/v1/query",
    data=json.dumps({"operation": "logs", "query": {"runId": run_id}}).encode(),
    headers={"Content-Type": "application/json"},
)
with urllib.request.urlopen(request) as response:
    result = json.load(response)
```

Register thin tools in the consumer's MCP framework that call this API.
Operations, input schemas, and reusable descriptions are exported from
`tracewick/contracts`. Alternatively, use the standalone MCP server without
writing an adapter.

## Collector and storage

Tables and indexes are declared in TypeScript with Drizzle ORM's Effect SQLite
driver. Fresh databases are created in-process with Drizzle Kit's headless
JavaScript `pushSchema` API; there are no generated SQL migration files or
out-of-band migration commands. The Effect driver currently requires the pinned
Drizzle rc5 prerelease.

Telemetry state records the installed tracewick version in
`.agents/otel/metadata.json`. Existing `cache.json` metadata is still readable
for compatibility. When a different version encounters an existing database (or
an old unversioned store), startup refuses to reuse it and explains that
proceeding will delete all old runs, logs and traces. **It does not delete
anything automatically.**

```sh
tracewick reset --project /path/to/worktree
# After explicit approval, for non-interactive use:
tracewick reset --project /path/to/worktree --yes
```

`reset` warns, defaults confirmation to No, stops the old collector under the
startup lock, and removes only the database, its WAL/SHM files and version
metadata. It leaves other files alone. Non-interactive clients must obtain user
approval and explicitly pass `--yes`; MCP queries never prompt on protocol stdin
or reset telemetry state. The next launch creates the new database from the
TypeScript schema. Restart previously instrumented applications to give them the
new collector endpoint.

One background collector is shared by commands in a worktree. Launchers start it
on demand; it stays available after children exit. Different worktrees have
different endpoints and SQLite stores under `.agents/otel/`. Discovery records
include a process instance identity to reject stale endpoints. Startup is
coordinated with an exclusive lock file; stale locks older than a minute can be
recovered. A forcibly killed startup may require waiting for that lease or
removing the stale lock after verifying no startup is active.

```sh
tracewick collect --retention-hours 24 --max-records 100000 --max-size-mb 64
tracewick stop
```

`collect` runs in the foreground; normally automatic startup is sufficient. Stop
the existing collector before selecting custom limits. Defaults cap active
record payloads at 64 MiB and 100,000 records, with 24-hour retention. SQLite
indexes, free pages, runs, WAL files and diagnostics add overhead; this is **not
a hard physical directory-size ceiling**. Deleted database pages are reused.
Maintenance removes old data in bounded batches. Individual records and
HTTP/decompressed payloads are bounded. Oversized/malformed records are rejected
with OTLP partial success counts. Log retries can produce duplicates; spans
upsert by trace/span ID.

Ignore `.agents/otel/` in version control. To reset everything, stop the
collector and trash that directory, including SQLite WAL/SHM files. Capture may
contain whatever applications emit, including source or model content. Querying
sends that content to the requesting agent/client; no automatic redaction is
promised.

Hard termination can lose buffered SDK telemetry and prevent run completion from
being recorded. The launcher does not manufacture traces for uninstrumented
commands. Always check status, run lifecycle, and available stderr before
drawing conclusions from missing spans. Self-terminated child signals are
retained in process error diagnostics; the structured signal field records
signals observed by the supervisor.

## Development

From the workspace root:

```sh
pnpm install
pnpm build
pnpm test:tracewick
node tracewick/cli.ts --help
```
