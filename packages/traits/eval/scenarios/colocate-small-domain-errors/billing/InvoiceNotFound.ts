import { Schema as S } from "effect"

export class InvoiceNotFound extends S.TaggedError<InvoiceNotFound>()("InvoiceNotFound", {
  invoiceId: S.String,
  message: S.String
}) {}
