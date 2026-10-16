---
id: 27ab2303-43a1-484b-b234-9a3b3b83dade
name: effect-values-for-parameterless-operations
when: exporting parameterless Effect operations.
mime: [text/typescript, text/tsx]
---
For parameterless Effect operations, export an Effect value instead of a zero-argument Effect.fn or Effect.fnUntraced function. Use Effect.gen when sequencing effectful work, or reuse an existing Effect directly when no generator is needed. Consumers should yield the Effect directly rather than invoke it. Preserve tracing with Effect.withSpan when appropriate.
