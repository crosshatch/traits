import { Array, Schema as S } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"

import { Discovery, EndRun, LocalLog, Run, TelemetryQueryRequest } from "./contracts.ts"
import { Payload } from "./otlp.ts"

const Protobuf = S.Uint8Array.pipe(HttpApiSchema.asUint8Array({ contentType: "application/x-protobuf" }))

const RunId = S.String.check(S.isPattern(/^[a-f0-9-]{36}$/))

const ErrorStatus = S.Literals([400, 403, 404, 409, 413, 415, 503])

const jsonErrors = Array.map(ErrorStatus.literals, (status) => S.JsonObject.pipe(HttpApiSchema.status(status)))

const otlpErrors = Array.appendAll(
  jsonErrors,
  Array.map(ErrorStatus.literals, (status) => Protobuf.pipe(HttpApiSchema.status(status)))
)

export const Api = HttpApi.make("tracewick").add(
  HttpApiGroup.make("collector").add(
    HttpApiEndpoint.get("health", "/health", { success: Discovery, error: jsonErrors }),
    HttpApiEndpoint.post("query", "/api/v1/query", {
      payload: TelemetryQueryRequest,
      success: S.JsonObject,
      error: jsonErrors
    }),
    HttpApiEndpoint.post("startRun", "/api/v1/runs/start", { payload: Run, success: S.JsonObject, error: jsonErrors }),
    HttpApiEndpoint.post("endRun", "/api/v1/runs/end", { payload: EndRun, success: S.JsonObject, error: jsonErrors }),
    HttpApiEndpoint.post("log", "/api/v1/log", { payload: LocalLog, success: S.JsonObject, error: jsonErrors }),
    HttpApiEndpoint.post("stop", "/api/v1/stop", {
      payload: S.Struct({ instance: S.String }),
      success: S.JsonObject,
      error: jsonErrors
    }),
    HttpApiEndpoint.post("traces", "/v1/traces", {
      payload: [Protobuf, Payload],
      success: [S.JsonObject, Protobuf],
      error: otlpErrors
    }),
    HttpApiEndpoint.post("logs", "/v1/logs", {
      payload: [Protobuf, Payload],
      success: [S.JsonObject, Protobuf],
      error: otlpErrors
    }),
    HttpApiEndpoint.post("runTraces", "/runs/:runId/v1/traces", {
      params: { runId: RunId },
      payload: [Protobuf, Payload],
      success: [S.JsonObject, Protobuf],
      error: otlpErrors
    }),
    HttpApiEndpoint.post("runLogs", "/runs/:runId/v1/logs", {
      params: { runId: RunId },
      payload: [Protobuf, Payload],
      success: [S.JsonObject, Protobuf],
      error: otlpErrors
    })
  )
)
