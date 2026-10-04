import * as Alchemy from "alchemy"
import * as Axiom from "alchemy/Axiom"
import * as Output from "alchemy/Output"
import { Effect } from "effect"

const Traces = Axiom.Dataset(
  "Traces",
  Alchemy.Stack.useSync((stack) => ({
    name: `${stack.name}-${stack.stage}-traces`,
    kind: "otel:traces:v1"
  }))
)

const Logs = Axiom.Dataset(
  "Logs",
  Alchemy.Stack.useSync((stack) => ({
    name: `${stack.name}-${stack.stage}-logs`,
    kind: "otel:logs:v1"
  }))
)

export const Ingest = Axiom.ApiToken(
  "Ingest",
  Effect.gen(function* () {
    const stack = yield* Alchemy.Stack
    const traces = yield* Traces
    const logs = yield* Logs

    return {
      name: `${stack.name}-${stack.stage}-ingest`,
      datasetCapabilities: Output.map(Output.all(traces.name, logs.name), ([traces, logs]) => ({
        [traces]: { ingest: ["create"] },
        [logs]: { ingest: ["create"] }
      }))
    }
  })
)

export const layer = Axiom.Telemetry({ token: Ingest, traces: Traces, logs: Logs })
