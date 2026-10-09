import { Layer, pipe, String } from "effect"
import { Url } from "effect/http"
import { OtlpLogger, OtlpSerialization, OtlpTracer } from "effect/observability"

import PackageJson from "../package.json" with { type: "json" }

export const layer = (endpoint: URL | undefined) => {
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
}
