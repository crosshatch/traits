import { Context, Effect, Schema as S } from "effect"

export const Invoice = S.Struct({
  id: S.String,
  amount: S.Number,
  status: S.Literals(["open", "paid", "refunded"])
})
export type Invoice = typeof Invoice.Type

export class InvoiceStore extends Context.Service<
  InvoiceStore,
  {
    readonly find: (id: string) => Effect.Effect<Invoice | undefined>
    readonly save: (invoice: Invoice) => Effect.Effect<void>
  }
>()("billing/InvoiceStore") {}
