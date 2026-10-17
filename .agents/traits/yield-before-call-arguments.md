---
name: yield-before-call-arguments
when: sequencing Effect generator results and passing them to transformations or function calls.
mime: [text/typescript, text/tsx]
---

```diff
-const result = transform(yield* load)
+const result = yield* load.pipe(Effect.map(transform))
```

---
Avoid yield* expressions inside function-call arguments in Effect generators. Apply the enclosing transformation to the effect and yield the result: provider = yield* load.pipe(Effect.map((value) => ConfigProvider.orElse(provider, value))), not provider = ConfigProvider.orElse(provider, yield* load). If composing is unclear, yield into a local variable first.
