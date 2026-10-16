import { layer } from "@effect/vitest"
import { ConfigProvider, Effect, FileSystem, Layer } from "effect"
import { ensureCollector, query, stopCollector } from "tracewick/client"
import { expect } from "vite-plus/test"

import * as TraitsTelemetry from "../_util/TraitsTelemetry.ts"
import { services } from "./Services.ts"

const liveTests = layer(services, { excludeTestServices: true })

const layerTelemetryFromEnv = (environment: Record<string, string>) =>
  TraitsTelemetry.layer.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(environment))))

liveTests((it) => {
  it.effect("leaves telemetry disabled when the endpoint environment variable is absent", () =>
    Effect.void.pipe(Effect.withSpan("disabled-telemetry"), Effect.provide(layerTelemetryFromEnv({})))
  )

  it.effect("validates the endpoint URL from the environment", () =>
    Effect.gen(function* () {
      const invalid = yield* Effect.void.pipe(
        Effect.provide(layerTelemetryFromEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "not-a-url" })),
        Effect.isFailure
      )
      expect(invalid).toBe(true)
    })
  )

  it.effect("exports spans to the run-specific endpoint supplied through the environment", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "traits-telemetry-" })
      yield* Effect.addFinalizer(() => stopCollector(directory).pipe(Effect.ignore))
      const collector = yield* ensureCollector(directory)
      const runId = "11111111-1111-4111-8111-111111111111"
      yield* Effect.void.pipe(
        Effect.withSpan("traits-environment-endpoint"),
        Effect.provide(layerTelemetryFromEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: `${collector.endpoint}/runs/${runId}` }))
      )
      const traces = yield* query(
        "traces",
        { runId, service: "traits", text: "traits-environment-endpoint" },
        directory
      )
      expect(traces.items).toHaveLength(1)
    })
  )
})
