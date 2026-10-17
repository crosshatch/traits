---
name: effect-foreach-for-collection-results
when: traversing a collection to perform Effects and collect the results.
mime: [text/typescript, text/tsx]
---

```diff
-const results = []
-for (const item of items) results.push(yield* processItem(item))
+const results = yield* Effect.forEach(items, processItem)
```

---
When traversing a collection to perform Effects and collect results, prefer Effect.forEach over a for loop that pushes into a mutable accumulator array. Preserve intended ordering, filtering, and concurrency semantics.
