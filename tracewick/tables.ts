import { sql } from "drizzle-orm"
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const counters = sqliteTable("counters", {
  name: text().primaryKey(),
  value: integer().notNull()
})

export const records = sqliteTable(
  "records",
  {
    attributes: text().notNull(),
    bytes: integer().notNull(),
    data: text().notNull(),
    duration: real().notNull(),
    error: integer().notNull(),
    kind: text().notNull(),
    runId: text(),
    seq: integer().primaryKey({ autoIncrement: true }),
    service: text().notNull(),
    severity: integer().notNull(),
    spanId: text(),
    text: text().notNull(),
    time: integer().notNull(),
    traceId: text()
  },
  (table) => [
    index("record_run").on(table.runId, table.seq),
    index("record_time").on(table.kind, table.time, table.seq),
    index("record_trace").on(table.traceId, table.spanId),
    uniqueIndex("span_identity")
      .on(table.traceId, table.spanId)
      .where(sql`${table.kind} = 'span'`)
  ]
)

export const runs = sqliteTable("runs", {
  command: text().notNull(),
  cwd: text().notNull(),
  ended: integer(),
  exitCode: integer(),
  id: text().notNull().unique(),
  name: text().notNull(),
  seq: integer().primaryKey({ autoIncrement: true }),
  signal: text(),
  started: integer().notNull()
})
