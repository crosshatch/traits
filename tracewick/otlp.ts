import { Array, Effect, flow, pipe, Predicate, Record, Schema as S } from "effect"
import { Base64, Hex } from "effect/encoding"
import protobuf from "protobufjs"

import { InvalidOtlpProtobuf } from "./errors.ts"

export interface DecodeOptions {
  readonly binary: boolean
  readonly body: Uint8Array
  readonly signal: "traces" | "logs"
}

// Minimal wire-compatible OTLP messages; unknown fields are ignored by protobuf.
const root = protobuf.parse(`syntax = "proto3";
message AnyValue { oneof value { string string_value=1; bool bool_value=2; int64 int_value=3; double double_value=4; ArrayValue array_value=5; KeyValueList kvlist_value=6; bytes bytes_value=7; } }
message ArrayValue { repeated AnyValue values=1; }
message KeyValueList { repeated KeyValue values=1; }
message KeyValue { string key=1; AnyValue value=2; }
message Resource { repeated KeyValue attributes=1; uint32 dropped_attributes_count=2; }
message Scope { string name=1; string version=2; repeated KeyValue attributes=3; uint32 dropped_attributes_count=4; }
message Status { string message=2; int32 code=3; }
message Event { fixed64 time_unix_nano=1; string name=2; repeated KeyValue attributes=3; uint32 dropped_attributes_count=4; }
message Link { bytes trace_id=1; bytes span_id=2; string trace_state=3; repeated KeyValue attributes=4; uint32 dropped_attributes_count=5; fixed32 flags=6; }
message Span { bytes trace_id=1; bytes span_id=2; string trace_state=3; bytes parent_span_id=4; string name=5; int32 kind=6; fixed64 start_time_unix_nano=7; fixed64 end_time_unix_nano=8; repeated KeyValue attributes=9; uint32 dropped_attributes_count=10; repeated Event events=11; uint32 dropped_events_count=12; repeated Link links=13; uint32 dropped_links_count=14; Status status=15; fixed32 flags=16; }
message ScopeSpans { Scope scope=1; repeated Span spans=2; string schema_url=3; }
message ResourceSpans { Resource resource=1; repeated ScopeSpans scope_spans=2; string schema_url=3; }
message Traces { repeated ResourceSpans resource_spans=1; }
message LogRecord { fixed64 time_unix_nano=1; int32 severity_number=2; string severity_text=3; AnyValue body=5; repeated KeyValue attributes=6; uint32 dropped_attributes_count=7; fixed32 flags=8; bytes trace_id=9; bytes span_id=10; fixed64 observed_time_unix_nano=11; string event_name=12; }
message ScopeLogs { Scope scope=1; repeated LogRecord log_records=2; string schema_url=3; }
message ResourceLogs { Resource resource=1; repeated ScopeLogs scope_logs=2; string schema_url=3; }
message Logs { repeated ResourceLogs resource_logs=1; }
message Partial { int64 rejected=1; string error_message=2; }
message Response { Partial partial_success=1; }
message ErrorStatus { string message=2; }
`).root

const isBytes = S.is(S.Uint8Array)
const hexIds = (value: unknown): unknown => {
  if (isBytes(value)) return Base64.encode(value)
  if (Array.isArray(value)) return Array.map(value, hexIds)
  if (!Predicate.isObject(value)) return value
  return Record.fromEntries(
    Array.map(Record.toEntries(value), ([key, item]) => [
      key,
      Array.contains(["traceId", "spanId", "parentSpanId"], key) && isBytes(item) ? Hex.encode(item) : hexIds(item)
    ])
  )
}

const ScopeBatch = S.Struct({
  scope: S.Record(S.String, S.Unknown).pipe(S.optionalKey),
  schemaUrl: S.String.pipe(S.optionalKey),
  spans: S.Array(S.Record(S.String, S.Unknown)).pipe(S.optionalKey),
  logRecords: S.Array(S.Record(S.String, S.Unknown)).pipe(S.optionalKey)
})

const ResourceBatch = S.Struct({
  resource: S.Record(S.String, S.Unknown).pipe(S.optionalKey),
  schemaUrl: S.String.pipe(S.optionalKey),
  scopeSpans: S.Array(ScopeBatch).pipe(S.optionalKey),
  scopeLogs: S.Array(ScopeBatch).pipe(S.optionalKey)
})

export type Payload = typeof Payload.Type
export const Payload = S.Struct({
  resourceSpans: S.Array(ResourceBatch).pipe(S.optionalKey),
  resourceLogs: S.Array(ResourceBatch).pipe(S.optionalKey)
})

export const decode = (options: DecodeOptions) => {
  const value: Effect.Effect<unknown, S.SchemaError | InvalidOtlpProtobuf> = options.binary
    ? Effect.try({
        try: () => {
          const type = root.lookupType(options.signal === "traces" ? "Traces" : "Logs")
          return hexIds(type.toObject(type.decode(options.body), { longs: String }))
        },
        catch: (cause) =>
          InvalidOtlpProtobuf.make({ signal: options.signal, sizeBytes: options.body.byteLength, cause })
      })
    : pipe(new TextDecoder().decode(options.body), S.decodeEffect(S.fromJsonString(S.Unknown)))
  return value.pipe(Effect.flatMap(S.decodeUnknownEffect(Payload)))
}
export const encodeResponse = (rejected: number) =>
  root
    .lookupType("Response")
    .encode(
      root
        .lookupType("Response")
        .create(
          rejected === 0 ? {} : { partialSuccess: { rejected, errorMessage: "Invalid or oversized records rejected" } }
        )
    )
    .finish()
export const encodeError = (message: string) =>
  root.lookupType("ErrorStatus").encode(root.lookupType("ErrorStatus").create({ message })).finish()
export const attributes = (value: unknown): Record<string, unknown> => {
  if (!Array.isArray(value)) return {}
  return Record.fromEntries(
    Array.flatMap(value, (entry: unknown) => {
      if (!Predicate.isObject(entry) || !Predicate.isString(entry.key)) return []
      return [[entry.key, Predicate.isObject(entry.value) ? Record.values(entry.value)[0] : entry.value]]
    })
  )
}

export const Nanoseconds = S.Union([
  S.String,
  S.Int.check(S.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }))
])

export const TraceId = S.String.check(S.isPattern(/^(?!0{32}$)[a-f0-9]{32}$/i))

export const SpanId = S.String.check(S.isPattern(/^(?!0{16}$)[a-f0-9]{16}$/i))

export const nanos = flow(
  S.decodeUnknownEffect(Nanoseconds),
  Effect.map(String),
  Effect.flatMap(S.decodeEffect(S.String.check(S.isPattern(/^\d{1,20}$/)))),
  Effect.map(BigInt)
)
