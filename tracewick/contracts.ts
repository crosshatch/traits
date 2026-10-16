import { Effect, Schema as S } from "effect"

export type Operation = typeof Operation.Type
export const Operation = S.Literals(["status", "runs", "run", "traces", "trace", "span", "logs"])

export type Query = typeof Query.Encoded
export const Query = S.Struct({
  attributes: S.Record(S.String, S.String)
    .pipe(S.optionalKey)
    .annotate({ description: "Exact span/log attribute filters. Resource attributes are included." }),
  cursor: S.String.pipe(S.optionalKey).annotate({
    description: "nextCursor from the previous page; retain the same operation and filters."
  }),
  errors: S.Boolean.pipe(S.optionalKey).annotate({
    description: "Only spans with error status or OTEL logs at ERROR severity or higher."
  }),
  includeData: S.Boolean.pipe(S.optionalKey).annotate({
    description:
      "Include full structured log payloads. Logs otherwise return compact previews; span detail always includes data."
  }),
  limit: S.Int.check(S.isBetween({ minimum: 1, maximum: 100 }))
    .pipe(S.withDecodingDefault(Effect.succeed(30)))
    .annotate({ description: "Maximum records per page, 1–100. Defaults to 30; byte limits can shorten a page." }),
  minDurationMs: S.Finite.pipe(S.optionalKey).annotate({
    description: "Minimum matching span duration in milliseconds."
  }),
  name: S.String.pipe(S.optionalKey).annotate({
    description: "Exact display name when listing runs. Names can identify multiple invocations."
  }),
  runId: S.String.pipe(S.optionalKey).annotate({
    description: "Unique invocation ID. Use it to scope evidence to one execution."
  }),
  service: S.String.pipe(S.optionalKey).annotate({ description: "Exact OTEL service.name." }),
  severity: S.Int.pipe(S.optionalKey).annotate({
    description: "Minimum OTEL log severity number; ERROR=17. Captured stderr uses synthetic severity 17."
  }),
  since: S.Finite.pipe(S.optionalKey).annotate({ description: "Inclusive lower timestamp bound, Unix milliseconds." }),
  spanId: S.String.pipe(S.optionalKey).annotate({
    description: "Span ID. Required with traceId for span detail; also filters correlated logs."
  }),
  text: S.String.pipe(S.optionalKey).annotate({
    description: "Case-insensitive substring of the span operation name or log body."
  }),
  traceId: S.String.pipe(S.optionalKey).annotate({
    description: "Trace ID. Required for trace/span detail; also filters correlated logs."
  }),
  until: S.Finite.pipe(S.optionalKey).annotate({ description: "Inclusive upper timestamp bound, Unix milliseconds." })
})

export const TelemetryQueryRequest = S.Struct({ operation: Operation, query: Query })

export type Discovery = typeof Discovery.Type
export const Discovery = S.Struct({
  endpoint: S.String.check(S.isPattern(/^http:\/\/127\.0\.0\.1:\d+$/)),
  instance: S.String,
  pid: S.Int.check(S.isGreaterThan(0))
})

export type Run = typeof Run.Type
export const Run = S.Struct({ id: S.String, name: S.String, command: S.Array(S.String), cwd: S.String })

export type EndRun = typeof EndRun.Type
export const EndRun = S.Struct({ runId: S.String, code: S.Int.pipe(S.NullOr), signal: S.String.pipe(S.NullOr) })

export type LocalLog = typeof LocalLog.Type
export const LocalLog = S.Struct({
  runId: S.String,
  text: S.String,
  kind: S.Literals(["stderr", "process"]),
  details: S.JsonObject.pipe(S.optionalKey)
})

export const operationDescriptions: Record<Operation, string> = {
  status: "Collector health, services and dropped data. Check before interpreting missing evidence.",
  runs: "List command invocations. Names may repeat; scope subsequent queries with the unique run ID.",
  run: "Read a run's command, directory, lifecycle and exit status. Requires runId.",
  traces: "Search trace summaries by run, service, operation text, errors, time, duration and attributes.",
  trace:
    "Read paginated spans in a trace, with parent IDs, failures and timing. Requires traceId. Query logs separately by traceId.",
  span: "Read span attributes, events and links. Requires traceId and spanId; query logs with those IDs for correlation.",
  logs: "Search OTEL logs and captured stderr/process diagnostics. Severity is a minimum OTEL number (ERROR=17). Filter by run, trace, time or attributes; paginate with nextCursor. Stderr severity is synthetic, not proof of a defect."
}
