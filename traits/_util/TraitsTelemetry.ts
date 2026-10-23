import { Layer } from "effect"
import { OtlpLogger, OtlpSerialization, OtlpTracer } from "effect/observability"

import PackageJson from "../package.json" with { type: "json" }

const resource = { serviceName: "traits", serviceVersion: PackageJson.version }

export const layer = Layer.mergeAll(
  OtlpTracer.layerFromConfig({ resource }),
  OtlpLogger.layerFromConfig({ resource })
).pipe(Layer.provide(OtlpSerialization.layerJson))
