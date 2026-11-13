import { formatCents } from "../billing/_common.ts"
import { heading, percentChange, table } from "./_common.ts"

export interface DailyTotals {
  readonly date: string
  readonly revenueCents: number
  readonly previousRevenueCents: number
  readonly orders: number
}

export const renderDaily = (totals: DailyTotals) =>
  [
    heading("Daily revenue", totals.date),
    table([
      ["Revenue", formatCents(totals.revenueCents)],
      ["Orders", String(totals.orders)],
      ["Change", `${percentChange(totals.previousRevenueCents, totals.revenueCents)}%`]
    ])
  ].join("\n")
