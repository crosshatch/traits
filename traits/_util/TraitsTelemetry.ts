import { Config, Effect, Layer, Option, pipe, Schema as S, String } from "effect"
import { Url } from "effect/http"
import { OtlpLogger, OtlpSerialization, OtlpTracer } from "effect/observability"

import PackageJson from "../package.json" with { type: "json" }

export const layer = Effect.gen(function* () {
  const endpoint = yield* Config.schema(S.URLFromString, "OTEL_EXPORTER_OTLP_ENDPOINT").pipe(
    Config.option,
    Effect.map(Option.getOrUndefined)
  )
  if (endpoint === undefined) return Layer.empty
  const url = (signal: string) =>
    pipe(
      endpoint,
      Url.setPathname(`${pipe(endpoint.pathname, String.replace(/\/$/, ""))}/v1/${signal}`),
      Url.setHash("")
    ).href
  const resource = { serviceName: "traits", serviceVersion: PackageJson.version }
  return Layer.mergeAll(
    OtlpTracer.layer({ url: url("traces"), resource }),
    OtlpLogger.layer({ url: url("logs"), resource })
  ).pipe(Layer.provide(OtlpSerialization.layerJson))
}).pipe(Layer.unwrap)
