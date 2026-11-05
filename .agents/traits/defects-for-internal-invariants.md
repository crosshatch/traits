---
name: defects-for-internal-invariants
subject: Classification of internal invariant violations and recoverable
  failures in Effect error channels.
requirement: Treat genuine internal invariant violations as defects, including
  validation or encoding failures of internally constructed, already-typed data
  when consumers cannot meaningfully recover. Preserve typed errors for
  actionable failures such as invalid consumer input, configuration, network,
  storage, and recoverable encoding failures. Neither typed input nor a
  handler's failure to catch an error is sufficient reason to classify a
  recoverable failure as a defect.
applicability: Applies to Effect error-channel design, including library
  validation and encoding of internally constructed data in TypeScript and TSX.
purpose: Keep recoverable error channels focused on actionable failures while
  exposing genuine internal invariant violations as defects.
---
For encoding that genuinely checks an internal invariant with no meaningful consumer recovery, use `Effect.orDie` rather than exposing `SchemaError` in the public error channel. This example does not apply to recoverable encoding failures.

```diff
-return pipe(internallyConstructed, S.encodeEffect(schema))
+return pipe(internallyConstructed, S.encodeEffect(schema), Effect.orDie)
```