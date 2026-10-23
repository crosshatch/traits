import { Array, Console, DateTime, Effect, Option, pipe, Schema as S, String } from "effect"

import * as Protocol from "./Protocol.ts"
import { T } from "./tables/index.ts"
import * as Telemetry from "./Telemetry.ts"

const cell = (value: unknown) => {
  if (value === undefined || value === null || value === "") return "-"
  return typeof value === "string" ? pipe(JSON.stringify(value), String.slice(1, -1)) : JSON.stringify(value)
}

const table = Effect.fnUntraced(function* (
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<unknown>>
) {
  if (rows.length === 0) return yield* Console.log("No matches.")
  yield* Console.log(Array.join(headers, "\t"))
  for (const row of rows) yield* Console.log(pipe(row, Array.map(cell), Array.join("\t")))
})

export const runs = Effect.fnUntraced(function* (rows: ReadonlyArray<T.runs["$inferSelect"]>, json: boolean) {
  if (json) return yield* Console.log(JSON.stringify(rows, null, 2))
  return yield* table(
    ["STARTED", "SECTION", "RUN", "EXIT", "COMMAND"],
    Array.map(rows, (run) => [
      pipe(run.startedAt, DateTime.makeUnsafe, DateTime.formatIso),
      run.sectionId,
      run.id,
      run.signal ?? run.exitCode ?? (run.endedAt === null ? "unfinished" : "unknown"),
      run.command
    ])
  )
})

export const records = Effect.fnUntraced(function* (
  rows: ReadonlyArray<Telemetry.Entry>,
  signal: Protocol.Signal,
  json: boolean
) {
  if (json) return yield* Console.log(JSON.stringify(rows, null, 2))
  const nanos = S.decodeUnknownOption(S.BigIntFromString)
  const message = S.Struct({ stringValue: S.String })
  const text = S.decodeUnknownOption(message)
  const texts = S.decodeUnknownOption(S.Struct({ arrayValue: S.Struct({ values: S.Array(message) }) }))
  return yield* table(
    signal === "traces"
      ? ["RECEIVED", "SECTION", "RUN", "TRACE", "SPAN", "DURATION", "ERROR", "NAME"]
      : ["RECEIVED", "SECTION", "RUN", "TRACE", "SPAN", "SEVERITY", "BODY"],
    Array.map(rows, (entry) => {
      const fields = [
        pipe(entry.receivedAt, DateTime.makeUnsafe, DateTime.formatIso),
        entry.sectionId,
        entry.runId,
        Telemetry.traceId(entry),
        entry.record.spanId
      ]
      if (signal === "logs") {
        const body = pipe(
          text(entry.record.body),
          Option.map((body) => body.stringValue),
          Option.orElse(() =>
            pipe(
              texts(entry.record.body),
              Option.map((body) =>
                pipe(
                  body.arrayValue.values,
                  Array.map((value) => value.stringValue),
                  Array.join(" ")
                )
              )
            )
          ),
          Option.getOrElse(() => entry.record.body)
        )
        return [
          ...fields,
          entry.record.severityText ??
            (typeof entry.record.severityNumber === "number"
              ? Protocol.severityNumber.valuesById[entry.record.severityNumber]
              : undefined),
          body
        ]
      }
      const duration = pipe(
        Option.all({ start: nanos(entry.record.startTimeUnixNano), end: nanos(entry.record.endTimeUnixNano) }),
        Option.map((time) => `${Number(time.end - time.start) / 1_000_000}ms`),
        Option.getOrUndefined
      )
      return [...fields, duration, Telemetry.isError(entry), entry.record.name]
    })
  )
})
