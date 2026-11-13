import { Array } from "effect"

import { formatCents, lineItem, sumCents } from "./_common.ts"

export interface Payment {
  readonly date: string
  readonly cents: number
}

export const renderStatement = (account: string, openingCents: number, payments: ReadonlyArray<Payment>) =>
  Array.join(
    [
      `Statement for ${account}`,
      lineItem("Opening balance", openingCents),
      ...Array.map(payments, (payment) => lineItem(`Payment ${payment.date}`, -payment.cents)),
      `Closing balance: ${formatCents(openingCents - sumCents(payments))}`
    ],
    "\n"
  )
