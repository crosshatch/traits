import { createServer } from "node:http"
import { gunzip } from "node:zlib"

import { NodeHttpServer } from "@effect/platform-node"
import { ByteSize, Clock, Context, Effect, Layer, pipe, String } from "effect"
import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"

import { Api } from "./Api.ts"
import * as Protocol from "./Protocol.ts"
import * as Telemetry from "./Telemetry.ts"

const maxBodySize = 16 * 1024 * 1024

export const start = Effect.fnUntraced(function* (runId: string) {
  const ingest = Effect.fnUntraced(
    function* (signal: Protocol.Signal) {
      const request = yield* HttpServerRequest.HttpServerRequest
      const contentType: string = pipe(
        request.headers["content-type"] ?? "",
        String.split(";"),
        (parts) => parts[0],
        String.trim,
        String.toLowerCase
      )
      if (contentType !== "application/json") {
        return HttpServerResponse.empty({ status: 415 })
      }
      const encoding = String.toLowerCase(request.headers["content-encoding"] ?? "identity")
      if (encoding !== "identity" && encoding !== "gzip") return HttpServerResponse.empty({ status: 415 })
      const bytes = yield* request.arrayBuffer
      const payload =
        encoding === "gzip"
          ? yield* Effect.callback<Buffer, Protocol.InvalidPayload>((resume) => {
              gunzip(Buffer.from(bytes), { maxOutputLength: maxBodySize }, (cause, result) => {
                resume(cause !== null ? Protocol.InvalidPayload.make({ cause }) : Effect.succeed(result))
              })
            })
          : Buffer.from(bytes)
      const body = yield* Protocol.decode(payload)
      const receivedAt = yield* Clock.currentTimeMillis
      yield* Telemetry.ingest(signal, runId, receivedAt, body)
      return HttpServerResponse.text("{}", { contentType })
    },
    Effect.catchTags({
      InvalidPayload: () => Effect.succeed(HttpServerResponse.empty({ status: 400 })),
      SchemaError: () => Effect.succeed(HttpServerResponse.empty({ status: 400 })),
      HttpServerError: () => Effect.succeed(HttpServerResponse.empty({ status: 400 })),
      EffectDrizzleQueryError: () =>
        Effect.succeed(HttpServerResponse.empty({ status: 503, headers: { "retry-after": "1" } })),
      SqlError: () => Effect.succeed(HttpServerResponse.empty({ status: 503, headers: { "retry-after": "1" } }))
    })
  )
  const handlers = HttpApiBuilder.group(Api, "otlp", (handlers) =>
    handlers.handleRaw("traces", () => ingest("traces")).handleRaw("logs", () => ingest("logs"))
  )
  const routes = HttpApiBuilder.layer(Api).pipe(Layer.provide(handlers))
  const server = HttpRouter.serve(routes, { disableLogger: true, disableListenLog: true }).pipe(
    Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })),
    Layer.provide(Layer.succeed(HttpServerRequest.MaxBodySize, ByteSize.bytes(maxBodySize)))
  )
  const context = yield* Layer.build(server)
  const address = Context.get(context, HttpServer.HttpServer).address
  if (address._tag === "UnixPathAddress") return yield* Effect.die("Expected a TCP listener")
  return `http://127.0.0.1:${address.port}`
})
