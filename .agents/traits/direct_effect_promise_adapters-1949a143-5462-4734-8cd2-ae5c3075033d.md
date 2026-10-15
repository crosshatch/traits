---
id: 1949a143-5462-4734-8cd2-ae5c3075033d
name: direct_effect_promise_adapters
when: adapting Promise-returning operations to Effect.
mime: [text/typescript, text/tsx]
---
Use `Effect.promise` directly at Promise boundaries instead of introducing generic wrapper helpers: `Effect.promise(() => client.run())`, not `fromPromise(() => client.run())` where `fromPromise` merely wraps `Effect.promise`.
