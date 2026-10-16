---
id: d2faffce-1aa4-4b06-b8a4-2f68986f226b
name: effect-vitest-layered-tests
---

Use @effect/vitest for Effect-based tests: supply common service layers through shared test utilities and layer(...), and pass test implementations to it.effect rather than invoking Effect.runPromise explicitly. Use live services/clocks when integration behavior requires them.
