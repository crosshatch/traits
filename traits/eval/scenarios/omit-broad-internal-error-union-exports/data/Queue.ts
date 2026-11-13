import { Context, Effect, Schema as S } from "effect"

export class QueueFull extends S.TaggedError<QueueFull>()("QueueFull", { queue: S.String }) {}

export class QueueClosed extends S.TaggedError<QueueClosed>()("QueueClosed", {
  queue: S.String,
  closedAt: S.Number
}) {}

export class BrokerUnavailable extends S.TaggedError<BrokerUnavailable>()("BrokerUnavailable", {
  cause: S.Defect()
}) {}

export type QueueError = QueueFull | QueueClosed | BrokerUnavailable

export interface Message {
  readonly id: string
  readonly queue: string
  readonly payload: unknown
}

export class Queue extends Context.Service<
  Queue,
  {
    readonly publish: (message: Message) => Effect.Effect<void, QueueError>
    readonly receive: (queue: string) => Effect.Effect<Message, QueueError>
    readonly acknowledge: (message: Message) => Effect.Effect<void, QueueError>
  }
>()("data/Queue") {}
