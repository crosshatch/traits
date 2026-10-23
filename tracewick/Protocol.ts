import { Array, Effect, pipe, Record, Schema as S } from "effect"
import protobuf from "protobufjs"

import descriptor from "./descriptor.json" with { type: "json" }

export type Signal = "traces" | "logs"
export type ContentType = "application/json" | "application/x-protobuf"

const root = protobuf.Root.fromJSON(descriptor as protobuf.INamespace)
export const requests = {
  traces: root.lookupType("opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest"),
  logs: root.lookupType("opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest")
}

export const severityNumber = root.lookupEnum("opentelemetry.proto.logs.v1.SeverityNumber")
export const statusCode = root.lookupEnum("opentelemetry.proto.trace.v1.Status.StatusCode")

// OTLP JSON uses hexadecimal IDs, while protobufjs's JSON mapping uses base64 for bytes.
const hexadecimalIds = (value: S.Json): S.Json => {
  if (Array.isArray<S.Json>(value)) return Array.map(value, hexadecimalIds)
  if (value !== null && typeof value === "object") {
    return Record.map(value, (value, key) =>
      (key === "traceId" || key === "spanId" || key === "parentSpanId") && typeof value === "string"
        ? Buffer.from(value, "base64").toString("hex")
        : hexadecimalIds(value)
    )
  }
  return value
}

export const decode = Effect.fnUntraced(function* (signal: Signal, contentType: ContentType, payload: Uint8Array) {
  if (contentType === "application/json") {
    const text = yield* Effect.try({
      try: () => new TextDecoder("utf-8", { fatal: true }).decode(payload),
      catch: (cause) => InvalidPayload.make({ cause })
    })
    return yield* pipe(text, S.decodeEffect(S.fromJsonString(S.JsonObject)))
  }
  const type = requests[signal]
  const object: unknown = yield* Effect.try({
    try: () => type.toObject(type.decode(payload), { longs: String, bytes: String, json: true }),
    catch: (cause) => InvalidPayload.make({ cause })
  })
  const json = yield* pipe(object, S.decodeUnknownEffect(S.JsonObject))
  return yield* pipe(hexadecimalIds(json), S.decodeUnknownEffect(S.JsonObject))
})

export class InvalidPayload extends S.TaggedError<InvalidPayload>()("InvalidPayload", {
  cause: S.Defect()
}) {}

const envelopes = {
  traces: S.Struct({ resourceSpans: S.Array(S.JsonObject).pipe(S.optional) }),
  logs: S.Struct({ resourceLogs: S.Array(S.JsonObject).pipe(S.optional) })
}

// Preserve the original wire payload; protobuf conversion is only used to check decodability.
export const validate = Effect.fnUntraced(function* (signal: Signal, contentType: ContentType, payload: Uint8Array) {
  const type = requests[signal]
  if (contentType === "application/x-protobuf") {
    yield* Effect.try({
      try: () => type.decode(payload),
      catch: (cause) => InvalidPayload.make({ cause })
    })
    return
  }
  const text = yield* Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(payload),
    catch: (cause) => InvalidPayload.make({ cause })
  })
  const value = yield* pipe(text, S.decodeEffect(S.fromJsonString(envelopes[signal])))
  yield* Effect.try({
    try: () => type.fromObject(value),
    catch: (cause) => InvalidPayload.make({ cause })
  })
})
