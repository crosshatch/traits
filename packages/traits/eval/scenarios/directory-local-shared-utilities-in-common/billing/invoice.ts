import { Array } from "effect"

import { formatCents, lineItem, sumCents } from "./_common.ts"

export interface InvoiceLine {
  readonly description: string
  readonly cents: number
}

export const renderInvoice = (customer: string, lines: ReadonlyArray<InvoiceLine>) =>
  Array.join(
    [
      `Invoice for ${customer}`,
      ...Array.map(lines, (line) => lineItem(line.description, line.cents)),
      `Total due: ${formatCents(sumCents(lines))}`
    ],
    "\n"
  )
