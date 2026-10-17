---
name: direct-effect-promise-adapters
when: adapting Promise-returning operations to Effect.
mime: [text/typescript, text/tsx]
---
Use `Effect.promise` directly at Promise boundaries instead of introducing generic wrapper helpers: `Effect.promise(() => client.run())`, not `fromPromise(() => client.run())` where `fromPromise` merely wraps `Effect.promise`.
