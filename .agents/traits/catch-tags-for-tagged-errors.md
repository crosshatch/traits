---
name: catch-tags-for-tagged-errors
when: recovering from tagged Effect errors.
mime: [text/typescript, text/tsx]
---

```diff
-Effect.catchTag("UnknownError", handler)
+Effect.catchTags({ UnknownError: handler })
```

---
Always prefer Effect.catchTags over Effect.catchTag for tagged-error recovery, including when handling only one error tag: Effect.catchTags({ UnknownError: handler }), not Effect.catchTag("UnknownError", handler). Preserve the existing handlers and error propagation behavior.
