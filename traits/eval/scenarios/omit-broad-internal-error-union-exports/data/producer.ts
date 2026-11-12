import { Effect, Schedule } from "effect"

import { type Message, Queue, type QueueError } from "./Queue.ts"
import { isRetryable } from "./retryPolicy.ts"

export const publishReliably = Effect.fn("producer.publishReliably")(function* (message: Message) {
  const queue = yield* Queue
  return yield* queue.publish(message).pipe(
    Effect.retry({ while: (error: QueueError) => isRetryable(error), schedule: Schedule.exponential("200 millis"), times: 5 })
  )
})
