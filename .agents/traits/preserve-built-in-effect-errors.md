---
name: preserve-built-in-effect-errors
when: deciding whether to wrap or remap built-in Effect errors.
mime: [text/typescript, text/tsx]
skip: When every custom error or error mapping under assessment is needed for recovery or a meaningful external boundary rather than merely wrapping a built-in Effect error.
---

```diff
-const read = fs.readFileString(file).pipe(Effect.mapError(wrapError))
+const read = fs.readFileString(file)
```

---
Preserve Effect’s built-in error types and let errors propagate naturally: prefer `fs.readFileString(file)` over `fs.readFileString(file).pipe(Effect.mapError(wrapError))`. Avoid custom error types or error mapping unless needed for recovery or a meaningful external boundary.
