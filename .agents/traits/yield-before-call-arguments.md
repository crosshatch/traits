---
name: yield-before-call-arguments
subject: Effect generator results passed to transformations or function calls.
requirement: "Avoid yield* expressions inside function-call arguments in Effect
  generators. Apply the enclosing transformation to the effect and yield the
  result: provider = yield* load.pipe(Effect.map((value) =>
  ConfigProvider.orElse(provider, value))), not provider =
  ConfigProvider.orElse(provider, yield* load). If composing is unclear, yield
  into a local variable first."
applicability: |-
  File types or languages: text/typescript, text/tsx.
---
```diff
-const result = transform(yield* load)
+const result = yield* load.pipe(Effect.map(transform))
```
