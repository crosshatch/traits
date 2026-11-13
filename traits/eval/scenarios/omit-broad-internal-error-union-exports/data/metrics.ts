import { Effect, Metric } from "effect"

import type { QueueError } from "./Queue.ts"

const failures = Metric.counter("queue_failures")

export const recordQueueFailure = (error: QueueError) =>
  Metric.update(Metric.withAttributes(failures, { reason: error._tag }), 1).pipe(Effect.andThen(Effect.fail(error)))
