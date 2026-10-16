import { Schema as S } from "effect"

import { Discovery, Operation, Query } from "./contracts.ts"

export class CollectorIdentityMismatch extends S.TaggedError<CollectorIdentityMismatch>()("CollectorIdentityMismatch", {
  discoveryFile: S.String,
  expected: Discovery,
  observed: Discovery
}) {
  override get message() {
    return `Collector identity mismatch at ${this.expected.endpoint}`
  }
}

export class CollectorHttpFailure extends S.TaggedError<CollectorHttpFailure>()("CollectorHttpFailure", {
  endpoint: S.String,
  method: S.Literals(["GET", "POST"]),
  path: S.String,
  status: S.Int,
  response: S.Json,
  responseBody: S.String
}) {
  override get message() {
    return `Collector HTTP ${this.status}: ${this.method} ${this.endpoint}${this.path}`
  }
}

export class CollectorInvalidResponse extends S.TaggedError<CollectorInvalidResponse>()("CollectorInvalidResponse", {
  endpoint: S.String,
  method: S.Literals(["GET", "POST"]),
  path: S.String,
  status: S.Int,
  responseBody: S.String,
  cause: S.Unknown
}) {
  override get message() {
    return `Invalid collector response: ${this.method} ${this.endpoint}${this.path}`
  }
}

export class CollectorHealthTimeout extends S.TaggedError<CollectorHealthTimeout>()("CollectorHealthTimeout", {
  collector: Discovery,
  discoveryFile: S.String,
  timeoutMs: S.Int
}) {
  override get message() {
    return `Collector health check timed out at ${this.collector.endpoint}`
  }
}

export class CollectorRequestTimeout extends S.TaggedError<CollectorRequestTimeout>()("CollectorRequestTimeout", {
  endpoint: S.String,
  method: S.Literal("POST"),
  path: S.String,
  timeoutMs: S.Int
}) {
  override get message() {
    return `Collector request timed out: POST ${this.endpoint}${this.path}`
  }
}

export class CollectorStartupTimeout extends S.TaggedError<CollectorStartupTimeout>()("CollectorStartupTimeout", {
  directory: S.String,
  discoveryFile: S.String,
  logFile: S.String,
  pid: S.Int,
  timeoutMs: S.Int
}) {
  override get message() {
    return `Collector startup timed out; inspect ${this.logFile}`
  }
}

export class CollectorShutdownPending extends S.TaggedError<CollectorShutdownPending>()("CollectorShutdownPending", {
  collector: Discovery,
  directory: S.String,
  timeoutMs: S.Int
}) {
  override get message() {
    return `Waiting for collector ${this.collector.pid} to stop; telemetry state has not been deleted`
  }
}

export class CollectorAlreadyRunning extends S.TaggedError<CollectorAlreadyRunning>()("CollectorAlreadyRunning", {
  collector: Discovery,
  directory: S.String
}) {
  override get message() {
    return `A collector is already running for ${this.directory}. Stop it before starting another.`
  }
}

export class ResetApprovalRequired extends S.TaggedError<ResetApprovalRequired>()("ResetApprovalRequired", {
  directory: S.String,
  databasePath: S.String,
  confirmationFlag: S.Literal("--yes")
}) {
  override get message() {
    return "Telemetry state has not been changed. Run reset --yes only after approving deletion, or run reset in an interactive terminal."
  }
}

export class CommandRequired extends S.TaggedError<CommandRequired>()("CommandRequired", {
  command: S.Array(S.String),
  directory: S.String
}) {
  override get message() {
    return "Expected a command after --"
  }
}

export class GitRootUnavailable extends S.TaggedError<GitRootUnavailable>()("GitRootUnavailable", {
  command: S.Array(S.String),
  directory: S.String,
  stdout: S.String
}) {
  override get message() {
    return `Git did not return a root for ${this.directory}`
  }
}

export class InvalidSpanTiming extends S.TaggedError<InvalidSpanTiming>()("InvalidSpanTiming", {
  traceId: S.String.pipe(S.NullOr),
  spanId: S.String.pipe(S.NullOr),
  startTimeUnixNano: S.String,
  endTimeUnixNano: S.String
}) {
  override get message() {
    return "Span ends before it starts"
  }
}

export class OtelRecordTooLarge extends S.TaggedError<OtelRecordTooLarge>()("OtelRecordTooLarge", {
  signal: S.Literals(["traces", "logs"]),
  traceId: S.String.pipe(S.NullOr),
  spanId: S.String.pipe(S.NullOr),
  sizeBytes: S.Int,
  maxBytes: S.Int
}) {
  override get message() {
    return `OTEL record exceeds ${this.maxBytes} bytes (${this.sizeBytes} bytes)`
  }
}

export class LocalLogTooLarge extends S.TaggedError<LocalLogTooLarge>()("LocalLogTooLarge", {
  runId: S.String,
  kind: S.Literals(["stderr", "process"]),
  sizeBytes: S.Int,
  maxBytes: S.Int
}) {
  override get message() {
    return `Local log exceeds ${this.maxBytes} bytes (${this.sizeBytes} bytes)`
  }
}

export class InvalidQueryCursor extends S.TaggedError<InvalidQueryCursor>()("InvalidQueryCursor", {
  operation: Operation,
  cursor: S.String
}) {
  override get message() {
    return `Invalid ${this.operation} cursor: ${this.cursor}`
  }
}

export class MissingRunId extends S.TaggedError<MissingRunId>()("MissingRunId", {
  operation: S.Literal("run"),
  query: Query
}) {
  override get message() {
    return "run requires runId"
  }
}

export class MissingTraceId extends S.TaggedError<MissingTraceId>()("MissingTraceId", {
  operation: S.Literals(["trace", "span"]),
  query: Query
}) {
  override get message() {
    return `${this.operation} requires traceId`
  }
}

export class MissingSpanId extends S.TaggedError<MissingSpanId>()("MissingSpanId", {
  operation: S.Literal("span"),
  query: Query
}) {
  override get message() {
    return "span requires spanId"
  }
}

export class RequestBodyTooLarge extends S.TaggedError<RequestBodyTooLarge>()("RequestBodyTooLarge", {
  path: S.String,
  receivedBytes: S.Int,
  maxBytes: S.Int
}) {
  override get message() {
    return `Request body exceeds ${this.maxBytes} bytes`
  }
}

export class DecompressedBodyTooLarge extends S.TaggedError<DecompressedBodyTooLarge>()("DecompressedBodyTooLarge", {
  path: S.String,
  compressedBytes: S.Int,
  maxBytes: S.Int,
  cause: S.Unknown
}) {
  override get message() {
    return `Decompressed request body exceeds ${this.maxBytes} bytes`
  }
}

export class InvalidGzipBody extends S.TaggedError<InvalidGzipBody>()("InvalidGzipBody", {
  path: S.String,
  compressedBytes: S.Int,
  cause: S.Unknown
}) {
  override get message() {
    return `Invalid gzip body for ${this.path}`
  }
}

export class InvalidOtlpProtobuf extends S.TaggedError<InvalidOtlpProtobuf>()("InvalidOtlpProtobuf", {
  signal: S.Literals(["traces", "logs"]),
  sizeBytes: S.Int,
  cause: S.Unknown
}) {
  override get message() {
    return `Invalid ${this.signal} protobuf payload (${this.sizeBytes} bytes)`
  }
}

export type QueryValidationError = InvalidQueryCursor | MissingRunId | MissingTraceId | MissingSpanId

export class RequestOriginRejected extends S.TaggedError<RequestOriginRejected>()("RequestOriginRejected", {
  path: S.String,
  host: S.String.pipe(S.NullOr),
  origin: S.String.pipe(S.NullOr)
}) {
  override get message() {
    return "Loopback clients only"
  }
}

export class UnsupportedContentEncoding extends S.TaggedError<UnsupportedContentEncoding>()(
  "UnsupportedContentEncoding",
  {
    path: S.String,
    encoding: S.String
  }
) {
  override get message() {
    return `Unsupported content encoding: ${this.encoding}`
  }
}

export class UnsupportedOtlpContentType extends S.TaggedError<UnsupportedOtlpContentType>()(
  "UnsupportedOtlpContentType",
  {
    path: S.String,
    contentType: S.String
  }
) {
  override get message() {
    return `Expected OTLP JSON or protobuf, received ${this.contentType}`
  }
}

export class CollectorStopIdentityMismatch extends S.TaggedError<CollectorStopIdentityMismatch>()(
  "CollectorStopIdentityMismatch",
  {
    expectedInstance: S.String,
    observedInstance: S.String
  }
) {
  override get message() {
    return "Collector stop request has the wrong instance identity"
  }
}

export class UnknownCollectorRoute extends S.TaggedError<UnknownCollectorRoute>()("UnknownCollectorRoute", {
  method: S.String,
  path: S.String
}) {
  override get message() {
    return `Unknown collector route: ${this.method} ${this.path}`
  }
}
