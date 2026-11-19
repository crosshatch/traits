---
name: parallelize-independent-effects
subject: Independent Effect operations within a workflow.
assertion: Prefer explicit parallel composition for Effect operations that do
  not depend on one another's results and can safely overlap, rather than
  sequential yield statements. Use Effect.all with an explicit concurrency
  option; use unbounded concurrency for predictably small, independent groups.
  Retain necessary sequencing for dependent results, shared mutable state,
  ordered side effects, and resource-lifecycle or failure semantics. Respect
  resource and rate limits for larger workloads.
purpose: Avoid unnecessary waiting while keeping dependencies and concurrency
  policy explicit.
---

```diff
-const a = yield* loadA
-const b = yield* loadB
+const [a, b] = yield* Effect.all([loadA, loadB], { concurrency: "unbounded" })
```

Independent dynamic imports and configuration lookups are examples; independence must include side effects, not just return values.

Not a violation: yields that only register declarations for an engine to run later, such as Alchemy resource declarations (`yield* GitHub.Variables(...)` then `yield* GitHub.Secrets(...)`) inside a stack. They wait on nothing and write to the stack's shared state in declaration order; the engine parallelizes the real operations.

Violation: two independent requests or file reads in sequence, in scripts as much as in library code, such as `const before = yield* score(draft)` then `const after = yield* score(revision)`; write `const [before, after] = yield* Effect.all([score(draft), score(revision)], { concurrency: "unbounded" })`.

Not a violation: yields that wait on nothing, such as service lookups (`yield* FileSystem.FileSystem` then `yield* Path.Path`), `Ref.make`, `Semaphore.make`, or decoding an in-memory value.

Not a violation: steps on one resource where a step changes what the next observes, such as two saves to the same file whose final contents depend on their order, or a read that first repairs a file's permissions followed by another read of that file.

Not a violation: a test that exercises an operation case by case, asserting on each result before the next call. The order of the cases is the test's narrative, and a failure should point at one case.
