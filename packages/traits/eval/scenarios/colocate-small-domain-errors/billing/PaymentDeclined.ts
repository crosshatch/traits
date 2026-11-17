import { Schema as S } from "effect"

export class PaymentDeclined extends S.TaggedError<PaymentDeclined>()("PaymentDeclined", {
  invoiceId: S.String,
  message: S.String
}) {}
