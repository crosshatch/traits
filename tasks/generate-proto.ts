import { Effect, FileSystem, Path } from "effect"
import { Command } from "effect/cli"
import { HttpClient, HttpClientResponse } from "effect/http"
import protobuf from "protobufjs"

const version = "v1.11.1"
const base = `https://raw.githubusercontent.com/open-telemetry/opentelemetry-proto/${version}/`
const files = [
  "opentelemetry/proto/common/v1/common.proto",
  "opentelemetry/proto/resource/v1/resource.proto",
  "opentelemetry/proto/trace/v1/trace.proto",
  "opentelemetry/proto/logs/v1/logs.proto",
  "opentelemetry/proto/collector/trace/v1/trace_service.proto",
  "opentelemetry/proto/collector/logs/v1/logs_service.proto"
]
export const generateProto = Command.make("generate-proto").pipe(
  Command.withDescription("Generate Tracewick's OTLP protobuf descriptor"),
  Command.withHandler(
    Effect.fn("tasks.generateProto")(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = new protobuf.Root()
      for (const file of files) {
        const text = yield* HttpClient.get(`${base}${file}`).pipe(
          Effect.flatMap(HttpClientResponse.filterStatusOk),
          Effect.flatMap((response) => response.text)
        )
        protobuf.parse(text, root)
      }
      root.resolveAll()
      yield* fs.writeFileString(
        path.resolve(import.meta.dirname, "../tracewick/descriptor.json"),
        `${JSON.stringify(root.toJSON(), null, 2)}\n`
      )
    })
  )
)
