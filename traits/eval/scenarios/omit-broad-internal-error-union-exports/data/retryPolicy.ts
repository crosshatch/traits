import type { QueueError } from "./Queue.ts"

export const isRetryable = (error: QueueError) =>
  error._tag === "BrokerUnavailable" || error._tag === "QueueFull"
