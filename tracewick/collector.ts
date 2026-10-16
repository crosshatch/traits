import { createServer } from "node:http"
import { gunzipSync } from "node:zlib"

import { NodeHttpServer } from "@effect/platform-node"
import { EffectDrizzleQueryError } from "drizzle-orm/effect-core/errors"
import {
  Array,
  Crypto,
  Deferred,
  Effect,
  FileSystem,
  Formatter,
  Layer,
  pipe,
  Predicate,
  Schedule,
  Schema as S,
  Stream,
  String
} from "effect"
import { Headers, HttpMethod, HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { SqlError } from "effect/sql"

import { Api } from "./Api.ts"
import { Discovery } from "./contracts.ts"
import { diagnostic } from "./Diagnostic.ts"
import {
  CollectorStopIdentityMismatch,
  DecompressedBodyTooLarge,
  InvalidGzipBody,
  RequestBodyTooLarge,
  RequestOriginRejected,
  UnknownCollectorRoute,
  UnsupportedContentEncoding
} from "./errors.ts"
import * as Otlp from "./otlp.ts"
import type { CaptureGroup } from "./project.ts"
import { Store } from "./store.ts"

const maxBody = 4 * 1024 * 1024
const isDatabaseError = Predicate.or(SqlError.isSqlError, S.is(EffectDrizzleQueryError))
const isLocalHeaders = S.is(
  S.Struct({
    host: S.String.check(S.isPattern(/^127\.0\.0\.1:\d+$/)),
    origin: S.Never.pipe(S.optionalKey)
  })
)
const contentType = (request: HttpServerRequest.HttpServerRequest) =>
  pipe(request.headers["content-type"] ?? "", String.split(";"), Array.headNonEmpty, String.trim, String.toLowerCase)
const failure = (error: unknown, status: number) =>
  Effect.map(HttpServerRequest.HttpServerRequest, (request) => {
    if (contentType(request) === "application/x-protobuf") {
      const bytes = Otlp.encodeError(Formatter.formatJson(diagnostic(error)))
      return HttpServerResponse.uint8Array(bytes, { status, contentType: "application/x-protobuf" })
    }
    return HttpServerResponse.text(Formatter.formatJson(diagnostic(error)), { status, contentType: "application/json" })
  })
const readBody = Effect.fn("Collector.readBody")(function* (request: HttpServerRequest.HttpServerRequest) {
  const encoding = request.headers["content-encoding"]
  if (encoding !== undefined && encoding !== "gzip" && encoding !== "identity")
    return yield* UnsupportedContentEncoding.make({ path: request.url, encoding })
  const chunks: Uint8Array[] = []
  let length = 0
  yield* request.stream.pipe(
    Stream.runForEach((chunk) => {
      length += chunk.byteLength
      if (length > maxBody)
        return RequestBodyTooLarge.make({ path: request.url, receivedBytes: length, maxBytes: maxBody })
      chunks.push(chunk)
      return Effect.void
    })
  )
  const body = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  if (encoding !== "gzip") return body
  return yield* Effect.try({
    try: () => gunzipSync(body, { maxOutputLength: maxBody }),
    catch: (error) =>
      Predicate.isObject(error) && error.code === "ERR_BUFFER_TOO_LARGE"
        ? DecompressedBodyTooLarge.make({
            path: request.url,
            compressedBytes: body.byteLength,
            maxBytes: maxBody,
            cause: error
          })
        : InvalidGzipBody.make({ path: request.url, compressedBytes: body.byteLength, cause: error })
  })
})

const isPayloadTooLarge = S.is(S.Union([RequestBodyTooLarge, DecompressedBodyTooLarge]))
const isUnsupported = S.is(UnsupportedContentEncoding)
const isProtobuf = S.is(S.Uint8Array)
const respond = Effect.catch((error: unknown) =>
  failure(error, isPayloadTooLarge(error) ? 413 : isUnsupported(error) ? 415 : isDatabaseError(error) ? 503 : 400)
)

export const start = Effect.fn("Collector.start")(function* (group: CaptureGroup) {
  const fs = yield* FileSystem.FileSystem
  const store = yield* Store
  const crypto = yield* Crypto.Crypto
  const instance = yield* crypto.randomUUIDv4
  const stopped = yield* Deferred.make<void>()
  const server = yield* NodeHttpServer.make(createServer, { host: "127.0.0.1", port: 0 })
  const discovery = Discovery.make({ endpoint: HttpServer.formatAddress(server.address), instance, pid: process.pid })
  const ingest = Effect.fn("Collector.ingest")(function* (
    signal: "traces" | "logs",
    runId: string | null,
    input: Otlp.Payload | Uint8Array
  ) {
    const binary = isProtobuf(input)
    const payload = binary ? yield* Otlp.decode({ signal, body: input, binary: true }) : input
    const rejected = yield* store.ingest(signal, payload, runId)
    return binary
      ? HttpServerResponse.uint8Array(Otlp.encodeResponse(rejected), { contentType: "application/x-protobuf" })
      : HttpServerResponse.jsonUnsafe(
          rejected === 0
            ? {}
            : {
                partialSuccess: {
                  [signal === "traces" ? "rejectedSpans" : "rejectedLogRecords"]: globalThis.String(rejected),
                  errorMessage: "Invalid or oversized records rejected"
                }
              }
        )
  }, respond)
  const handlers = HttpApiBuilder.group(Api, "collector", (handlers) =>
    handlers
      .handle("health", () => Effect.succeed(discovery))
      .handle("query", (input) => store.query(input.payload.operation, input.payload.query).pipe(respond))
      .handle("startRun", (input) => store.startRun(input.payload).pipe(Effect.as(S.JsonObject.make({})), respond))
      .handle("endRun", (input) => store.endRun(input.payload).pipe(Effect.as(S.JsonObject.make({})), respond))
      .handle("log", (input) => store.log(input.payload).pipe(Effect.as(S.JsonObject.make({})), respond))
      .handle("stop", (input) =>
        input.payload.instance === instance
          ? Deferred.succeed(stopped, undefined).pipe(Effect.as(S.JsonObject.make({})))
          : failure(
              CollectorStopIdentityMismatch.make({
                expectedInstance: instance,
                observedInstance: input.payload.instance
              }),
              409
            )
      )
      .handle("traces", (input) => ingest("traces", null, input.payload))
      .handle("logs", (input) => ingest("logs", null, input.payload))
      .handle("runTraces", (input) => ingest("traces", input.params.runId, input.payload))
      .handle("runLogs", (input) => ingest("logs", input.params.runId, input.payload))
  )
  const routes = yield* HttpRouter.toHttpEffect(
    HttpApiBuilder.layer(Api).pipe(Layer.provide([handlers, HttpServer.layerServices]))
  )
  // Transport-only middleware; HttpApi owns route matching and payload codecs.
  const handler = Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    if (!isLocalHeaders(request.headers))
      return yield* failure(
        RequestOriginRejected.make({
          path: request.url,
          host: request.headers.host ?? null,
          origin: request.headers.origin ?? null
        }),
        403
      )
    if (!HttpMethod.hasBody(request.method)) return yield* routes
    const body = yield* readBody(request)
    const headers = pipe(request.headers, Headers.remove("content-encoding"), Headers.remove("content-length"))
    const normalized = HttpServerRequest.fromWeb(
      new globalThis.Request(`http://localhost${request.url}`, {
        method: request.method,
        headers,
        body: new Uint8Array(body)
      })
    )
    return yield* routes.pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, normalized))
  }).pipe(
    Effect.catchReasons("HttpServerError", {
      RouteNotFound: (error) =>
        failure(UnknownCollectorRoute.make({ method: error.request.method, path: error.request.url }), 404)
    }),
    respond
  )
  yield* server.serve(handler)
  const file = `${group.state}/collector.json`
  const temporary = `${group.state}/collector-${instance}.json`
  const serialized = yield* pipe(discovery, S.encodeEffect(S.fromJsonString(Discovery)), Effect.orDie)
  yield* fs.writeFileString(temporary, serialized)
  yield* fs.rename(temporary, file)
  yield* Effect.addFinalizer(() => fs.remove(file).pipe(Effect.ignore))
  yield* store.prune.pipe(
    Effect.catch(Effect.logError),
    Effect.repeat(Schedule.spaced("30 seconds")),
    Effect.forkScoped
  )
  return { discovery, awaitStop: Deferred.await(stopped) }
})
