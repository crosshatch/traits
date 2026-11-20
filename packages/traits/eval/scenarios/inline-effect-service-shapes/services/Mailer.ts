import { Context, Effect } from "effect"

export interface MailerShape {
  readonly send: (to: string, subject: string, body: string) => Effect.Effect<void>
  readonly sendBatch: (recipients: ReadonlyArray<string>, subject: string, body: string) => Effect.Effect<number>
}

export class Mailer extends Context.Service<Mailer, MailerShape>()("services/Mailer") {}
