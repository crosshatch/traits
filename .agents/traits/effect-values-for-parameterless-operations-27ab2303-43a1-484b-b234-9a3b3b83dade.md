---
id: 27ab2303-43a1-484b-b234-9a3b3b83dade
name: effect-values-for-parameterless-operations
when: exporting parameterless Effect operations.
mime: [text/typescript, text/tsx]
---
For parameterless Effect operations, export an Effect value instead of a zero-argument Effect.fn or Effect.fnUntraced function; consumers should yield it directly. Use Effect.gen when that value sequences effectful work, or reuse an existing Effect directly when no generator is needed, preserving tracing with Effect.withSpan when appropriate. Prefer ordinary arrow functions for functions that simply return or compose existing Effects. Reserve Effect.fn for genuine generator sequencing or a deliberate, useful tracing boundary.
