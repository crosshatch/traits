import { Console, Effect, Layer } from "effect"

import { Mailer } from "./Mailer.ts"

export const consoleMailer = Layer.succeed(Mailer, {
  send: (to, subject, body) => Console.log(`To: ${to}\nSubject: ${subject}\n\n${body}`),
  sendBatch: (recipients, subject, body) =>
    Effect.as(
      Effect.forEach(recipients, (to) => Console.log(`To: ${to}\nSubject: ${subject}\n\n${body}`), { discard: true }),
      recipients.length
    )
})
