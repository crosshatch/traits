---
name: map-final-effect-transformations-in-pipeline
purpose: Keep a final result transformation attached to the effect that produces its input.
subject: Final pure transformations of Effect results.
requirement: When an Effect result is bound only to apply a final pure
  transformation and immediately return it, keep that transformation in the
  Effect pipeline with Effect.map and return the composed Effect directly (or
  return yield it inside a generator), rather than introducing a temporary
  result binding.
---
```diff
-const items = yield* load
-return Array.map(items, transform)
+return yield* load.pipe(Effect.map(Array.map(transform)))
```
