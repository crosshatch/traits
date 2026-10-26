import { Effect, pipe, Schema as S, String } from "effect"

import { T } from "../tables/index.ts"
import { TraitDatabase } from "../TraitDatabase.ts"
import type { Signal } from "./Protocol.ts"

// Decode indexed fields separately so the original JSON record retains unknown fields.
const fields = S.Struct({
  traceId: S.String.pipe(S.optional),
  spanId: S.String.pipe(S.optional),
  parentSpanId: S.String.pipe(S.optional),
  name: S.String.pipe(S.optional),
  startTimeUnixNano: S.String.pipe(S.optional),
  endTimeUnixNano: S.String.pipe(S.optional),
  timeUnixNano: S.String.pipe(S.optional),
  observedTimeUnixNano: S.String.pipe(S.optional),
  severityNumber: S.Int.pipe(S.optional),
  severityText: S.String.pipe(S.optional),
  status: S.Struct({ code: S.Int.pipe(S.optional) }).pipe(S.optional)
})

export const ingest = Effect.fnUntraced(function* (
  signal: Signal,
  runId: string,
  receivedAt: number,
  body: S.JsonObject
) {
  const db = yield* TraitDatabase
  const objects = S.decodeUnknownEffect(S.Array(S.JsonObject))
  const groups = yield* objects(body[signal === "traces" ? "resourceSpans" : "resourceLogs"] ?? [])
  yield* Effect.gen(function* () {
    for (const group of groups) {
      const resource = yield* pipe(group.resource ?? {}, S.decodeUnknownEffect(S.JsonObject))
      const resourceSchemaUrl = yield* pipe(group.schemaUrl ?? "", S.decodeUnknownEffect(S.String))
      const scopes = yield* objects(group[signal === "traces" ? "scopeSpans" : "scopeLogs"] ?? [])
      for (const group of scopes) {
        const scope = yield* pipe(group.scope ?? {}, S.decodeUnknownEffect(S.JsonObject))
        const scopeSchemaUrl = yield* pipe(group.schemaUrl ?? "", S.decodeUnknownEffect(S.String))
        const records = yield* objects(group[signal === "traces" ? "spans" : "logRecords"] ?? [])
        for (const record of records) {
          const indexed = yield* pipe(record, S.decodeEffect(fields))
          const common = {
            runId,
            receivedAt,
            record,
            resource,
            scope,
            resourceSchemaUrl,
            scopeSchemaUrl,
            traceId: indexed.traceId === undefined ? undefined : String.toLowerCase(indexed.traceId),
            spanId: indexed.spanId === undefined ? undefined : String.toLowerCase(indexed.spanId)
          }
          if (signal === "traces") {
            yield* db.insert(T.spans).values({
              ...common,
              parentSpanId: indexed.parentSpanId === undefined ? undefined : String.toLowerCase(indexed.parentSpanId),
              name: indexed.name,
              startTimeUnixNano: indexed.startTimeUnixNano,
              endTimeUnixNano: indexed.endTimeUnixNano,
              statusCode: indexed.status?.code
            })
          } else {
            yield* db.insert(T.logs).values({
              ...common,
              timeUnixNano: indexed.timeUnixNano,
              observedTimeUnixNano: indexed.observedTimeUnixNano,
              severityNumber: indexed.severityNumber,
              severityText: indexed.severityText
            })
          }
        }
      }
    }
  }).pipe(db.$client.withTransaction)
})
