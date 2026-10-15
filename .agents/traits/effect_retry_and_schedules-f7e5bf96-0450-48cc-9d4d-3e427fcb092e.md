---
id: f7e5bf96-0450-48cc-9d4d-3e427fcb092e
name: effect_retry_and_schedules
when: adding retry or backoff behavior to Effect operations.
mime: [text/typescript, text/tsx]
---
Never manually implement retry or backoff logic. Use Effect’s built-in retry and scheduling APIs when retries are warranted: `request.pipe(Effect.retry({ times: 3, while: isTransient, schedule: Schedule.exponential("100 millis") }))`, not a retry loop with sleeps. Apply retries conservatively, with bounded attempts and appropriate failure filtering.
