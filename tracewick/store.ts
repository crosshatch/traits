import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  lte,
  max,
  min,
  ne,
  notInArray,
  sql,
  type SQL
} from "drizzle-orm"
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core/errors"
import {
  Array,
  Clock,
  Context,
  Effect,
  Layer,
  Number,
  Option,
  pipe,
  Predicate,
  Record,
  Schema as S,
  String
} from "effect"
import type { SqlError } from "effect/sql"

import { type EndRun, type LocalLog, type Operation, Query, type Run } from "./contracts.ts"
import * as Database from "./database.ts"
import {
  InvalidQueryCursor,
  InvalidSpanTiming,
  LocalLogTooLarge,
  MissingRunId,
  MissingSpanId,
  MissingTraceId,
  OtelRecordTooLarge,
  type QueryValidationError
} from "./errors.ts"
import { attributes, nanos, SpanId, TraceId, type Payload } from "./otlp.ts"
import type { CaptureGroup } from "./project.ts"
import { counters, records, runs } from "./tables.ts"

export interface StoreService {
  readonly endRun: (run: EndRun) => Effect.Effect<void, EffectDrizzleQueryError>
  readonly ingest: (
    signal: "traces" | "logs",
    payload: Payload,
    runId: string | null
  ) => Effect.Effect<number, EffectDrizzleQueryError | SqlError.SqlError>
  readonly log: (input: LocalLog) => Effect.Effect<void, EffectDrizzleQueryError | SqlError.SqlError | LocalLogTooLarge>
  readonly prune: Effect.Effect<void, EffectDrizzleQueryError>
  readonly query: (
    operation: Operation,
    input: Query
  ) => Effect.Effect<S.JsonObject, EffectDrizzleQueryError | S.SchemaError | QueryValidationError>
  readonly startRun: (run: Run) => Effect.Effect<void, EffectDrizzleQueryError>
}

export type Policy = typeof Policy.Type
export const Policy = S.Struct({
  maxBytes: S.Int.check(S.isGreaterThan(0)).pipe(S.withDecodingDefault(Effect.succeed(64 * 1024 * 1024))),
  maxRecords: S.Int.check(S.isGreaterThan(0)).pipe(S.withDecodingDefault(Effect.succeed(100000))),
  retentionHours: S.Finite.check(S.isGreaterThan(0)).pipe(S.withDecodingDefault(Effect.succeed(24)))
})

/** Drizzle limits rows; this adds the response-byte budget and continuation cursor. */
const paginate = <Row extends S.JsonObject & { readonly seq: number | null }>(
  rows: ReadonlyArray<Row>,
  limit: number
): S.JsonObject => {
  let size = 0
  const items = pipe(
    rows,
    Array.take(limit),
    Array.takeWhile((row, index) => {
      size += new TextEncoder().encode(JSON.stringify(row)).byteLength
      // Always include one row so an oversized item cannot stall pagination.
      return index === 0 || size <= 256 * 1024
    })
  )
  const truncated = items.length < rows.length
  const last = Option.getOrUndefined(Array.last(items))
  return S.JsonObject.make({
    items,
    nextCursor: truncated && last !== undefined ? globalThis.String(last.seq) : null,
    truncated
  })
}

const normalize = Effect.fnUntraced(function* (
  record: Readonly<Record<string, unknown>>,
  signal: "traces" | "logs",
  resource: Readonly<Record<string, unknown>>,
  scope: Readonly<Record<string, unknown>>,
  now: number
) {
  const span = signal === "traces"
  const traceId =
    span || (record.traceId !== undefined && record.traceId !== "")
      ? yield* pipe(record.traceId, S.decodeUnknownEffect(TraceId), Effect.map(String.toLowerCase))
      : null
  const spanId =
    span || (record.spanId !== undefined && record.spanId !== "")
      ? yield* pipe(record.spanId, S.decodeUnknownEffect(SpanId), Effect.map(String.toLowerCase))
      : null
  const logTime = record.timeUnixNano === "0" || record.timeUnixNano === 0 ? undefined : record.timeUnixNano
  const observedTime =
    record.observedTimeUnixNano === "0" || record.observedTimeUnixNano === 0 ? undefined : record.observedTimeUnixNano
  const start = yield* nanos(
    span ? record.startTimeUnixNano : (logTime ?? observedTime ?? globalThis.String(BigInt(now) * 1000000n))
  )
  const end = yield* (span ? nanos(record.endTimeUnixNano) : Effect.succeed(start)).pipe(
    Effect.filterOrFail(
      (value) => value >= start,
      (value) =>
        InvalidSpanTiming.make({
          traceId,
          spanId,
          startTimeUnixNano: globalThis.String(start),
          endTimeUnixNano: globalThis.String(value)
        })
    )
  )
  const resourceAttributes = attributes(resource.attributes)
  const attrs = { ...resourceAttributes, ...attributes(record.attributes) }
  const service = Predicate.isString(resourceAttributes["service.name"])
    ? resourceAttributes["service.name"]
    : "unknown"
  const severity = Predicate.isNumber(record.severityNumber) ? record.severityNumber : 0
  const status = Predicate.isObject(record.status) ? record.status.code : 0
  const data = yield* pipe(
    { ...record, resource, scope },
    S.encodeUnknownEffect(S.fromJsonString(S.JsonObject)),
    Effect.filterOrFail(
      (value) => new TextEncoder().encode(value).byteLength <= 128 * 1024,
      (value) =>
        OtelRecordTooLarge.make({
          signal,
          traceId,
          spanId,
          sizeBytes: new TextEncoder().encode(value).byteLength,
          maxBytes: 128 * 1024
        })
    )
  )
  const text = span ? (Predicate.isString(record.name) ? record.name : "") : JSON.stringify(record.body ?? "")
  const encodedAttributes = JSON.stringify(attrs)
  return {
    kind: span ? "span" : "log",
    service,
    traceId,
    spanId,
    time: globalThis.Number(start / 1000000n),
    severity,
    error: span ? globalThis.Number(status === 2) : globalThis.Number(severity >= 17),
    duration: globalThis.Number(end - start) / 1e6,
    text,
    attributes: encodedAttributes,
    data,
    bytes:
      new TextEncoder().encode(data).byteLength +
      new TextEncoder().encode(text).byteLength +
      new TextEncoder().encode(encodedAttributes).byteLength
  }
})

const make = (group: CaptureGroup, policy: Policy) =>
  Effect.map(Database.Database, (database) => {
    const { db, transaction } = database
    const totalsQuery = db
      .select({ count: count(), bytes: sql<number>`coalesce(sum(${records.bytes}),0)` })
      .from(records)
    const trim = Effect.gen(function* () {
      let totals = yield* totalsQuery
      while ((totals[0]?.count ?? 0) > policy.maxRecords || (totals[0]?.bytes ?? 0) > policy.maxBytes) {
        const batch = pipe(Math.floor((totals[0]?.count ?? 0) / 100), Number.clamp({ minimum: 1, maximum: 1000 }))
        const oldest = db.select({ seq: records.seq }).from(records).orderBy(asc(records.seq)).limit(batch)
        yield* db.delete(records).where(inArray(records.seq, oldest))
        totals = yield* totalsQuery
      }
    })
    const ingest = Effect.fn("Store.ingest")(function* (
      signal: "traces" | "logs",
      payload: Payload,
      runId: string | null
    ) {
      const now = yield* Clock.currentTimeMillis
      let rejected = 0
      yield* transaction(
        Effect.gen(function* () {
          for (const resource of signal === "traces" ? (payload.resourceSpans ?? []) : (payload.resourceLogs ?? [])) {
            for (const scope of signal === "traces" ? (resource.scopeSpans ?? []) : (resource.scopeLogs ?? [])) {
              for (const record of signal === "traces" ? (scope.spans ?? []) : (scope.logRecords ?? [])) {
                const normalized = yield* normalize(
                  {
                    ...record,
                    ...(resource.schemaUrl === undefined ? {} : { resourceSchemaUrl: resource.schemaUrl }),
                    ...(scope.schemaUrl === undefined ? {} : { scopeSchemaUrl: scope.schemaUrl })
                  },
                  signal,
                  resource.resource ?? {},
                  scope.scope ?? {},
                  now
                ).pipe(Effect.option, Effect.map(Option.getOrUndefined))
                if (normalized === undefined) {
                  rejected++
                  continue
                }
                const row = { ...normalized, runId }
                yield* db
                  .insert(records)
                  .values(row)
                  .onConflictDoUpdate({
                    target: [records.traceId, records.spanId],
                    targetWhere: sql`${records.kind} = 'span'`,
                    set: {
                      data: sql`excluded.data`,
                      time: sql`excluded.time`,
                      error: sql`excluded.error`,
                      duration: sql`excluded.duration`,
                      text: sql`excluded.text`,
                      attributes: sql`excluded.attributes`,
                      bytes: sql`excluded.bytes`
                    }
                  })
              }
            }
          }
          yield* db
            .insert(counters)
            .values({ name: "rejected", value: rejected })
            .onConflictDoUpdate({ target: counters.name, set: { value: sql`${counters.value} + excluded.value` } })
          yield* trim
        })
      )
      return rejected
    })
    const startRun = (run: Run) =>
      Clock.currentTimeMillis.pipe(
        Effect.flatMap((started) => db.insert(runs).values({ ...run, command: JSON.stringify(run.command), started })),
        Effect.asVoid
      )
    const endRun = (run: EndRun) =>
      Clock.currentTimeMillis.pipe(
        Effect.flatMap((ended) =>
          db.update(runs).set({ ended, exitCode: run.code, signal: run.signal }).where(eq(runs.id, run.runId))
        ),
        Effect.asVoid
      )
    const log = Effect.fn("Store.log")(function* (input: LocalLog) {
      const time = yield* Clock.currentTimeMillis
      const data = JSON.stringify({
        body: input.text,
        source: input.kind,
        ...(input.details === undefined ? {} : { details: input.details })
      })
      if (new TextEncoder().encode(data).byteLength > 128 * 1024)
        return yield* LocalLogTooLarge.make({
          runId: input.runId,
          kind: input.kind,
          sizeBytes: new TextEncoder().encode(data).byteLength,
          maxBytes: 128 * 1024
        })
      yield* transaction(
        Effect.gen(function* () {
          yield* db.insert(records).values({
            kind: input.kind,
            runId: input.runId,
            service: "tracewick",
            traceId: null,
            spanId: null,
            time,
            severity: input.kind === "stderr" ? 17 : 9,
            error: 0,
            duration: 0,
            text: input.text,
            attributes: "{}",
            data,
            bytes: new TextEncoder().encode(data).byteLength + new TextEncoder().encode(input.text).byteLength
          })
          yield* trim
        })
      )
    })
    const query = Effect.fn("Store.query")(function* (operation: Operation, input: Query) {
      const q = yield* pipe(input, S.decodeEffect(Query))
      if (operation === "status") {
        const storedCounters = yield* db.select().from(counters)
        const services = yield* db
          .select({ service: records.service, records: count(), lastSeen: max(records.time) })
          .from(records)
          .groupBy(records.service)
        return S.JsonObject.make({ version: 1, captureGroup: { ...group }, policy, counters: storedCounters, services })
      }
      const limit = q.limit
      const cursor = q.cursor === undefined ? undefined : globalThis.Number(q.cursor)
      if (cursor !== undefined && (!globalThis.Number.isSafeInteger(cursor) || cursor < 0))
        return yield* InvalidQueryCursor.make({ operation, cursor: globalThis.String(q.cursor) })
      const conditions: SQL[] = []
      if (operation === "run" && q.runId === undefined) return yield* MissingRunId.make({ operation, query: q })
      if ((operation === "trace" || operation === "span") && q.traceId === undefined)
        return yield* MissingTraceId.make({ operation, query: q })
      if (operation === "span" && q.spanId === undefined) return yield* MissingSpanId.make({ operation, query: q })
      if (operation === "runs" || operation === "run") {
        if (q.runId !== undefined) {
          conditions.push(eq(runs.id, q.runId))
        }
        if (q.name !== undefined) {
          conditions.push(eq(runs.name, q.name))
        }
        if (cursor !== undefined) {
          conditions.push(lt(runs.seq, cursor))
        }
        const rows = yield* db
          .select()
          .from(runs)
          .where(and(...conditions))
          .orderBy(desc(runs.seq))
          .limit(limit + 1)
        return paginate(rows, limit)
      }
      conditions.push(operation === "logs" ? ne(records.kind, "span") : eq(records.kind, "span"))
      for (const key of ["runId", "service", "traceId", "spanId"] as const)
        if (q[key] !== undefined) {
          conditions.push(eq(records[key], q[key]))
        }
      if (q.text !== undefined) {
        conditions.push(sql`instr(lower(${records.text}),lower(${q.text}))>0`)
      }
      if (q.errors === true) conditions.push(eq(records.error, 1))
      if (q.since !== undefined) conditions.push(gte(records.time, q.since))
      if (q.until !== undefined) conditions.push(lte(records.time, q.until))
      if (q.severity !== undefined) conditions.push(gte(records.severity, q.severity))
      if (q.minDurationMs !== undefined) conditions.push(gte(records.duration, q.minDurationMs))
      for (const [key, value] of Record.toEntries(q.attributes ?? {})) {
        conditions.push(
          sql`exists(select 1 from json_each(${records.attributes}) where key=${key} and cast(value as text)=${value})`
        )
      }
      if (operation === "traces") {
        const sequence = max(records.seq)
        const rows = yield* db
          .select({
            seq: sequence,
            traceId: records.traceId,
            started: min(records.time),
            ended: sql<number>`max(${records.time}+${records.duration})`,
            matchingSpans: count(),
            error: max(records.error)
          })
          .from(records)
          .where(and(...conditions))
          .groupBy(records.traceId)
          .having(cursor === undefined ? undefined : lt(sequence, cursor))
          .orderBy(desc(sequence))
          .limit(limit + 1)
        return paginate(rows, limit)
      }
      if (cursor !== undefined) {
        conditions.push(lt(records.seq, cursor))
      }
      const includeData = operation !== "logs" || q.includeData === true
      const rows = yield* db
        .select({
          seq: records.seq,
          kind: records.kind,
          runId: records.runId,
          service: records.service,
          traceId: records.traceId,
          spanId: records.spanId,
          time: records.time,
          severity: records.severity,
          error: records.error,
          duration: records.duration,
          text: sql<string>`substr(${records.text},1,1000)`,
          textTruncated: sql<number>`length(${records.text})>1000`,
          ...(includeData ? { data: records.data } : {})
        })
        .from(records)
        .where(and(...conditions))
        .orderBy(desc(records.seq))
        .limit(limit + 1)
      if (!includeData) return paginate(rows, limit)
      const decoded = yield* Effect.forEach(rows, (row) =>
        pipe(
          row.data,
          S.decodeUnknownEffect(S.fromJsonString(S.JsonObject)),
          Effect.map((data) => ({ ...row, data }))
        )
      )
      return paginate(decoded, limit)
    })
    const prune = Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      const cutoff = now - policy.retentionHours * 3600_000
      const expired = db.select({ seq: records.seq }).from(records).where(lt(records.time, cutoff)).limit(5000)
      yield* db.delete(records).where(inArray(records.seq, expired))
      const activeRuns = db.selectDistinct({ runId: records.runId }).from(records).where(isNotNull(records.runId))
      yield* db.delete(runs).where(and(lt(runs.ended, cutoff), notInArray(runs.id, activeRuns)))
      yield* trim
      yield* db.run(sql`PRAGMA wal_checkpoint(PASSIVE)`)
    })
    return { ingest, query, startRun, endRun, log, prune } satisfies StoreService
  })
export class Store extends Context.Service<Store, StoreService>()("tracewick/store") {}
export const layer = (options: { readonly group: CaptureGroup; readonly policy?: typeof Policy.Encoded | undefined }) =>
  Layer.effect(
    Store,
    pipe(
      options.policy ?? {},
      S.decodeEffect(Policy),
      Effect.flatMap((policy) => make(options.group, policy))
    )
  ).pipe(Layer.provide(Database.layer(options.group)))
