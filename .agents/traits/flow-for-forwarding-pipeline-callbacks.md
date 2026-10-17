---
mime:
  - text/typescript
  - text/tsx
name: flow-for-forwarding-pipeline-callbacks
when: a callback only forwards its argument through a pipe of transformations.
---

```diff
-const process = (input) => pipe(input, parse, build)
+const process = flow(parse, build)
```

---
Use flow to compose callbacks and function definitions that only forward their input through successive transformations, whether expressed as a pipe or as an intermediate variable followed by a return. For example, use flow(parse, build) rather than (input) => { const value = parse(input); return build(value) }. A stage may return a closure over its transformed input, such as flow(traitIgnores, (references) => Array.filter((trait) => !references.has(trait.name))). Keep a callback when it needs additional logic or argument handling that flow would not preserve.
