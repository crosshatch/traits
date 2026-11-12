import { Effect } from "effect"

import { InvoiceStore } from "./Invoice.ts"
import { loadInvoice } from "./loadInvoice.ts"
import { PaymentDeclined } from "./PaymentDeclined.ts"
import { PaymentGateway } from "./PaymentGateway.ts"

export const charge = Effect.fn("billing.charge")(function* (invoiceId: string) {
  const invoice = yield* loadInvoice(invoiceId)
  const gateway = yield* PaymentGateway
  const result = yield* gateway.charge(invoice.id, invoice.amount)
  if (!result.approved) {
    return yield* PaymentDeclined.make({ invoiceId, message: `The charge was declined: ${result.reason}` })
  }
  const store = yield* InvoiceStore
  yield* store.save({ ...invoice, status: "paid" })
})
