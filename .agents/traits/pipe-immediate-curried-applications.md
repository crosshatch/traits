---
name: pipe-immediate-curried-applications
when: immediately applying the function returned by a curried call to a value.
mime: [text/typescript, text/tsx, text/javascript, text/jsx]
---
When a function call returns a function that is immediately applied to a value, use `pipe(value, fn(args))`, never `fn(args)(value)`. Inspect nested call expressions even across line breaks and inside `yield*`: use `yield* pipe(decomposed, S.encodeEffect(schema))`, not `yield* S.encodeEffect(schema)(decomposed)`. This applies even to one transformation and when no data-first overload exists. It does not prohibit calling a previously stored function or using a genuine data-first overload such as `Array.map(items, f)`.
