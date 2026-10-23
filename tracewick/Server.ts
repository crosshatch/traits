import { createServer } from "node:http"
import { gunzip } from "node:zlib"

import { NodeHttpServer } from "@effect/platform-node"
import { ByteSize, Clock, Context, Effect, Layer, pipe, String } from "effect"
import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"

import { Api } from "./Api.ts"
import { Database } from "./Database.ts"
import * as Protocol from "./Protocol.ts"
import { T } from "./tables/index.ts"

const maxBodySize = 16 * 1024 * 1024

export const start = Effect.fnUntraced(function* (runId: string) {
  const db = yield* Database
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
      if (contentType !== "application/json" && contentType !== "application/x-protobuf") {
        return HttpServerResponse.empty({ status: 415 })
      }
      const encoding = String.toLowerCase(request.headers["content-encoding"] ?? "identity")
      if (encoding !== "identity" && encoding !== "gzip") return HttpServerResponse.empty({ status: 415 })
      const bytes = yield* request.arrayBuffer
      const payload =
        encoding === "gzip"
          ? yield* Effect.callback<Buffer, Protocol.InvalidPayload>((resume) => {
              gunzip(Buffer.from(bytes), { maxOutputLength: maxBodySize }, (cause, result) => {
                resume(cause !== null ? Effect.fail(Protocol.InvalidPayload.make({ cause })) : Effect.succeed(result))
              })
            })
          : Buffer.from(bytes)
      yield* Protocol.validate(signal, contentType, payload)
      const receivedAt = yield* Clock.currentTimeMillis
      yield* db.insert(T.exports).values({ runId, signal, contentType, receivedAt, payload })
      return contentType === "application/json"
        ? HttpServerResponse.text("{}", { contentType })
        : HttpServerResponse.uint8Array(new Uint8Array(), { contentType })
    },
    Effect.catchTags({
      InvalidPayload: () => Effect.succeed(HttpServerResponse.empty({ status: 400 })),
      SchemaError: () => Effect.succeed(HttpServerResponse.empty({ status: 400 })),
      HttpServerError: () => Effect.succeed(HttpServerResponse.empty({ status: 400 })),
      EffectDrizzleQueryError: () =>
        Effect.succeed(HttpServerResponse.empty({ status: 503, headers: { "retry-after": "1" } }))
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
