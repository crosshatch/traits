import { Effect } from "effect"

import { InvoiceStore } from "./Invoice.ts"
import { InvoiceNotFound } from "./InvoiceNotFound.ts"

export const loadInvoice = Effect.fn("billing.loadInvoice")(function* (invoiceId: string) {
  const store = yield* InvoiceStore
  const invoice = yield* store.find(invoiceId)
  if (invoice === undefined) {
    return yield* InvoiceNotFound.make({ invoiceId, message: `No invoice has the ID ${invoiceId}.` })
  }
  return invoice
})
