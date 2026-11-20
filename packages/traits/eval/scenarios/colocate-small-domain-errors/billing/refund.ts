import { Effect } from "effect"

import { InvoiceStore } from "./Invoice.ts"
import { loadInvoice } from "./loadInvoice.ts"
import { PaymentDeclined } from "./PaymentDeclined.ts"
import { PaymentGateway } from "./PaymentGateway.ts"

export const refund = Effect.fn("billing.refund")(function* (invoiceId: string) {
  const invoice = yield* loadInvoice(invoiceId)
  if (invoice.status !== "paid") {
    return
  }
  const gateway = yield* PaymentGateway
  const result = yield* gateway.refund(invoice.id, invoice.amount)
  if (!result.approved) {
    return yield* PaymentDeclined.make({ invoiceId, message: `The refund was declined: ${result.reason}` })
  }
  const store = yield* InvoiceStore
  yield* store.save({ ...invoice, status: "refunded" })
})
