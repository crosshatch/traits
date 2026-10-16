---
id: b7480d3f-ce74-4a49-bd7c-2d6817dffebd
name: effect-aware-tests
when: writing or updating tests that execute Effects or acquire scoped resources.
mime: [text/typescript, text/tsx, text/javascript, text/jsx]
---
Use @effect/vitest wherever tests execute Effects, yielding Effects directly through its Effect-aware test APIs instead of manually calling Effect.runSync or Effect.runPromise in ordinary test callbacks. Use the installed version's scoped testing support for resource cleanup; @effect/vitest 4 provides Scope through it.effect itself. Keep ordinary test APIs for pure synchronous tests or framework-specific harnesses that do not execute Effects.
