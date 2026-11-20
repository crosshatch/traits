---
name: flat-transformation-pipelines
subject: Successive transformations and Effect.fn transformation arguments. In
  TypeScript or TSX files.
assertion: "Use `.pipe(...)` for pipeable values and `pipe(value, ...)` for
  other values to keep successive transformations flat and readable in execution
  order, rather than nesting transformation calls around an expression. For
  example, prefer `pipe(value, Redacted.value, String.trim)` over
  `String.trim(Redacted.value(value))`, and `Effect.gen(...).pipe(Layer.unwrap,
  Layer.provide(dependencies))` over
  `Layer.unwrap(Effect.gen(...)).pipe(Layer.provide(dependencies))`. Keep
  successive transformations in the same pipe where practical. For `Effect.fn`
  and `Effect.fnUntraced`, use their transformation arguments as the equivalent
  flat composition style for transformations that wrap the whole operation, such
  as providing services, holding a lock, spans, retries, timeouts, or uniform
  error translation. Steps that follow the operation's work, such as logging or
  printing its result or running a follow-up effect on its return value, are not
  such transformations: write them as statements at the end of the generator
  body, not as Effect.andThen, Effect.tap, or Effect.flatMap in a transformation
  argument. A flow or pipe composition passed as a single callback argument
  (e.g. Effect.map(flow(f, g))) is not nesting; flag only transformation calls
  applied around a value expression."
purpose: Make transformation order readable without mentally unwinding nested
  calls, and keep an operation's own steps in its body.
---

```diff
-const layer = Layer.unwrap(effect).pipe(Layer.provide(dependencies))
+const layer = effect.pipe(Layer.unwrap, Layer.provide(dependencies))
```

Not a violation: a composed callback argument wraps no value.

```ts
const load = flow(get, Effect.map(flow(run, Effect.flatMap(decode))))
```

Violation: transformation calls wrapped around a value.

```ts
const text = String.trim(Redacted.value(secret))
```

Violation: a step that follows the operation's work, chained in an Effect.fn transformation argument.

```ts
Effect.fn("auth.logout")(
  function* (params) {
    yield* Accounts.write(remaining)
  },
  withLock,
  (effect, params) => effect.pipe(Effect.andThen(Console.log(`Removed ${params.account}.`)))
)
```

Correct: the message is the last step of the body; `withLock` stays a transformation because it wraps the whole operation.

```ts
Effect.fn("auth.logout")(
  function* (params) {
    yield* Accounts.write(remaining)
    yield* Console.log(`Removed ${params.account}.`)
  },
  withLock
)
```
