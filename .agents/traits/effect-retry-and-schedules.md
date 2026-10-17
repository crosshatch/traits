---
name: effect-retry-and-schedules
when: adding retry or backoff behavior to Effect operations.
mime: [text/typescript, text/tsx]
---

```diff
-for (let attempt = 0; attempt < 3; attempt++) { /* retry request and sleep manually */ }
+const retried = request.pipe(Effect.retry({ times: 3, while: isTransient, schedule: Schedule.exponential("100 millis") }))
```

---
Never manually implement retry or backoff logic. Use Effect’s built-in retry and scheduling APIs when retries are warranted: `request.pipe(Effect.retry({ times: 3, while: isTransient, schedule: Schedule.exponential("100 millis") }))`, not a retry loop with sleeps. Apply retries conservatively, with bounded attempts and appropriate failure filtering.
