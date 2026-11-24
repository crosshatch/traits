import { sqliteTable, text } from "drizzle-orm/sqlite-core"

export type traits = typeof traits
export const traits = sqliteTable("traits", {
  name: text().primaryKey(),
  subject: text().notNull(),
  requirement: text().notNull(),
  applicability: text(),
  purpose: text().notNull(),
  context: text(),
  // Content hash of the Markdown file the row was indexed from.
  version: text().notNull()
})
