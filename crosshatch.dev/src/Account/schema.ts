import { integer, sqliteTable } from "drizzle-orm/sqlite-core"

export const counter = sqliteTable("counter", {
  id: integer("id").primaryKey(),
  value: integer("value").notNull().default(0)
})
