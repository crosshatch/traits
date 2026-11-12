import { Context, Effect } from "effect"

export interface GatewayResult {
  readonly approved: boolean
  readonly reason: string
}

export class PaymentGateway extends Context.Service<
  PaymentGateway,
  {
    readonly charge: (invoiceId: string, amount: number) => Effect.Effect<GatewayResult>
    readonly refund: (invoiceId: string, amount: number) => Effect.Effect<GatewayResult>
  }
>()("billing/PaymentGateway") {}
