import { and, desc, eq, gte, lt, lte } from "drizzle-orm"
import { Array, Effect, pipe, String } from "effect"

import { Database } from "./Database.ts"
import * as Protocol from "./Protocol.ts"
import { T } from "./tables/index.ts"
import * as Telemetry from "./Telemetry.ts"

export type Filters = {
  readonly id?: string | undefined
  readonly since?: number | undefined
  readonly until?: number | undefined
  readonly limit: number
}

export type RecordFilters = Filters & {
  readonly run?: string | undefined
  readonly trace?: string | undefined
  readonly search?: string | undefined
  readonly errors: boolean
}

export const runs = Effect.fnUntraced(function* (filters: Filters) {
  const db = yield* Database
  return yield* db
    .select()
    .from(T.runs)
    .where(
      and(
        filters.id === undefined ? undefined : eq(T.runs.sectionId, filters.id),
        filters.since === undefined ? undefined : gte(T.runs.startedAt, filters.since),
        filters.until === undefined ? undefined : lte(T.runs.startedAt, filters.until)
      )
    )
    .orderBy(desc(T.runs.startedAt), desc(T.runs.id))
    .limit(filters.limit)
})

export const records = Effect.fnUntraced(function* (signal: Protocol.Signal, filters: RecordFilters) {
  const db = yield* Database
  const matches: Array<Telemetry.Entry> = []
  const search = filters.search === undefined ? undefined : String.toLowerCase(filters.search)
  const trace = filters.trace === undefined ? undefined : String.toLowerCase(filters.trace)
  let before: number | undefined
  // Keyset pagination bounds each read and excludes new exports arriving during this search.
  while (matches.length < filters.limit) {
    const batches = yield* db
      .select({ batch: T.exports, sectionId: T.runs.sectionId })
      .from(T.exports)
      .innerJoin(T.runs, eq(T.exports.runId, T.runs.id))
      .where(
        and(
          eq(T.exports.signal, signal),
          before === undefined ? undefined : lt(T.exports.id, before),
          filters.id === undefined ? undefined : eq(T.runs.sectionId, filters.id),
          filters.run === undefined ? undefined : eq(T.exports.runId, filters.run),
          filters.since === undefined ? undefined : gte(T.exports.receivedAt, filters.since),
          filters.until === undefined ? undefined : lte(T.exports.receivedAt, filters.until)
        )
      )
      .orderBy(desc(T.exports.id))
      .limit(100)
    if (batches.length === 0) break
    for (const row of batches) {
      const entries = yield* Telemetry.decode(row.batch, row.sectionId)
      for (const entry of Array.reverse(entries)) {
        if (trace !== undefined && Telemetry.traceId(entry) !== trace) continue
        if (filters.errors && !Telemetry.isError(entry)) continue
        if (search !== undefined) {
          const text = yield* Telemetry.searchText(entry)
          if (!pipe(text, String.includes(search))) continue
        }
        matches.push(entry)
        if (matches.length === filters.limit) return matches
      }
      before = row.batch.id
    }
  }
  return matches
})
