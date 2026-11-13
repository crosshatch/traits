import { Effect, Schedule } from "effect"

import { charge } from "./charge.ts"
import { PaymentDeclined } from "./PaymentDeclined.ts"

export const retryCharge = Effect.fn("billing.retryCharge")(function* (invoiceId: string, attempts: number) {
  return yield* charge(invoiceId).pipe(
    Effect.retry({
      while: (error) => error instanceof PaymentDeclined,
      schedule: Schedule.exponential("1 second"),
      times: attempts
    })
  )
})
