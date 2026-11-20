import { Array } from "effect"

export const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`

export const lineItem = (label: string, cents: number) => `${label.padEnd(28)}${formatCents(cents).padStart(12)}`

export const sumCents = (items: ReadonlyArray<{ readonly cents: number }>) =>
  Array.reduce(items, 0, (total, item) => total + item.cents)
