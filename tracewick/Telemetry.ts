import { Array, Effect, pipe, Schema as S, String, Struct } from "effect"

import * as Protocol from "./Protocol.ts"
import { T } from "./tables/index.ts"

export type Entry = {
  readonly exportId: number
  readonly recordIndex: number
  readonly runId: T.runs["$inferSelect"]["id"]
  readonly sectionId: T.runs["$inferSelect"]["sectionId"]
  readonly receivedAt: number
  readonly signal: Protocol.Signal
  readonly resource: S.JsonObject
  readonly scope: S.JsonObject
  readonly resourceSchemaUrl: string
  readonly scopeSchemaUrl: string
  readonly record: S.JsonObject
}

export class UnreadableExport extends S.TaggedError<UnreadableExport>()("UnreadableExport", {
  exportId: S.Int,
  cause: S.Defect()
}) {
  override get message() {
    return `Cannot decode stored OTLP export ${this.exportId}`
  }
}

export const decode = Effect.fnUntraced(
  function* (batch: T.exports["$inferSelect"], sectionId: Entry["sectionId"]) {
    const body = yield* Protocol.decode(batch.signal, batch.contentType, batch.payload)
    const objects = S.decodeUnknownEffect(S.Array(S.JsonObject))
    const resources = yield* objects(body[batch.signal === "traces" ? "resourceSpans" : "resourceLogs"] ?? [])
    return yield* Effect.forEach(
      resources,
      Effect.fnUntraced(function* (group) {
        const resource = yield* pipe(group.resource ?? {}, S.decodeUnknownEffect(S.JsonObject))
        const resourceSchemaUrl = yield* pipe(group.schemaUrl ?? "", S.decodeUnknownEffect(S.String))
        const scopes = yield* objects(group[batch.signal === "traces" ? "scopeSpans" : "scopeLogs"] ?? [])
        return yield* Effect.forEach(
          scopes,
          Effect.fnUntraced(function* (group) {
            const scope = yield* pipe(group.scope ?? {}, S.decodeUnknownEffect(S.JsonObject))
            const scopeSchemaUrl = yield* pipe(group.schemaUrl ?? "", S.decodeUnknownEffect(S.String))
            const records = yield* objects(group[batch.signal === "traces" ? "spans" : "logRecords"] ?? [])
            return Array.map(records, (record) => ({
              exportId: batch.id,
              runId: batch.runId,
              sectionId,
              receivedAt: batch.receivedAt,
              signal: batch.signal,
              resource,
              scope,
              resourceSchemaUrl,
              scopeSchemaUrl,
              record
            }))
          })
        ).pipe(Effect.map(Array.flatten))
      })
    ).pipe(Effect.map(Array.flatten), Effect.map(Array.map((entry, recordIndex): Entry => ({ ...entry, recordIndex }))))
  },
  (effect, batch) => effect.pipe(Effect.mapError((cause) => UnreadableExport.make({ exportId: batch.id, cause })))
)

export const traceId = (entry: Entry) =>
  typeof entry.record.traceId === "string" ? String.toLowerCase(entry.record.traceId) : ""

export const isError = (entry: Entry) => {
  if (entry.signal === "logs") {
    return (
      typeof entry.record.severityNumber === "number" &&
      entry.record.severityNumber >= Protocol.severityNumber.values.SEVERITY_NUMBER_ERROR!
    )
  }
  const status = entry.record.status
  return (
    status !== null &&
    typeof status === "object" &&
    !Array.isArray<typeof status>(status) &&
    status.code === Protocol.statusCode.values.STATUS_CODE_ERROR
  )
}

export const searchText = Effect.fnUntraced(function* (entry: Entry) {
  return yield* pipe(
    entry,
    Struct.pick(["record", "resource", "scope"]),
    S.encodeEffect(S.fromJsonString(S.JsonObject)),
    Effect.orDie,
    Effect.map(String.toLowerCase)
  )
})
