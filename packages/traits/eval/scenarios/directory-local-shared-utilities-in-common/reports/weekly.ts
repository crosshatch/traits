import { Array } from "effect"

import { heading, percentChange, table } from "./_common.ts"

export interface WeekSignups {
  readonly week: string
  readonly signups: ReadonlyArray<number>
  readonly previousTotal: number
}

export const renderWeekly = (week: WeekSignups) => {
  const total = Array.reduce(week.signups, 0, (sum, count) => sum + count)
  return [
    heading("Weekly signups", week.week),
    table([
      ["Signups", String(total)],
      ["Best day", String(Math.max(...week.signups))],
      ["Change", `${percentChange(week.previousTotal, total)}%`]
    ])
  ].join("\n")
}
