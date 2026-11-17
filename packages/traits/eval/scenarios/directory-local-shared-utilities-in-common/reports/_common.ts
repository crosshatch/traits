import { Array } from "effect"

export const percentChange = (previous: number, current: number) =>
  previous === 0 ? 0 : Math.round(((current - previous) / previous) * 1000) / 10

export const heading = (title: string, period: string) => `${title} (${period})`

export const table = (rows: ReadonlyArray<readonly [string, string]>) =>
  Array.join(
    Array.map(rows, ([label, value]) => `${label.padEnd(28)}${value.padStart(12)}`),
    "\n"
  )
