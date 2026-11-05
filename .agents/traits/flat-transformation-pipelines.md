---
name: flat-transformation-pipelines
subject: Successive transformations and Effect.fn transformation arguments.
requirement: Use `.pipe(...)` for pipeable values and `pipe(value, ...)` for
  other values to keep successive transformations flat and readable in execution
  order, rather than nesting transformation calls around an expression. For
  example, prefer `pipe(value, Redacted.value, String.trim)` over
  `String.trim(Redacted.value(value))`, and `Effect.gen(...).pipe(Layer.unwrap,
  Layer.provide(dependencies))` over
  `Layer.unwrap(Effect.gen(...)).pipe(Layer.provide(dependencies))`. Keep
  successive transformations in the same pipe where practical. For `Effect.fn`
  and `Effect.fnUntraced`, use their transformation arguments as the equivalent
  flat composition style.
applicability: "File types or languages: text/typescript, text/tsx."
purpose: Make transformation order readable without mentally unwinding nested calls.
---
```diff
-const layer = Layer.unwrap(effect).pipe(Layer.provide(dependencies))
+const layer = effect.pipe(Layer.unwrap, Layer.provide(dependencies))
```