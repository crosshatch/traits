---
id: 7c8cd8f6-fc64-40e9-b3b2-bc9bb40539d6
name: effect-generator-sequencing
---

For parameterless Effect operations, export an Effect value instead of a zero-argument Effect.fn or Effect.fnUntraced function; consumers should yield it directly. Use Effect.gen when that value sequences effectful work, or reuse an existing Effect directly when no generator is needed, preserving tracing only when useful. For parameterized functions that sequence multiple Effects, prefer Effect.fn with a generator, or Effect.fnUntraced in library code when no tracing boundary is needed, over nested Effect.flatMap arrow callbacks; yield each effect explicitly. Prefer ordinary arrow functions for functions that simply return or compose existing Effects. Do not add redundant tracing spans merely to wrap an obvious program root.
